// ============================================================
// Combat system -- damage calculation, near-death, attack resolution
// ============================================================

import { Injectable } from '@nestjs/common'
import type {
  BattleLogEntry,
  DeployedCharacter,
  GameState,
  PlayerState,
  TurnPhase,
} from './types'
import { getCharacterDef } from './character-data'

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function now(): number {
  return Date.now()
}

function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId)
}

function findDeployedChar(
  player: PlayerState,
  charUid: string,
): { slotIndex: number; char: DeployedCharacter } | undefined {
  for (let i = 0; i < player.deployed.length; i++) {
    const char = player.deployed[i].character
    if (char && char.uid === charUid) {
      return { slotIndex: i, char }
    }
  }
  return undefined
}

function addBattleLog(
  state: GameState,
  playerId: string,
  action: string,
  details?: string,
): void {
  state.battleLog.push({
    turn: state.turnNumber,
    phase: state.turnPhase as TurnPhase,
    playerId,
    action,
    details,
    timestamp: now(),
  })
}

// ------------------------------------------------------------
// Service
// ------------------------------------------------------------

@Injectable()
export class CombatService {
  // ----------------------------------------------------------
  // Damage calculation
  // ----------------------------------------------------------

  /**
   * Base damage = attacker's attack stat.
   * If attacker has an attackBoost buff, add its value.
   */
  calculateDamage(
    attacker: DeployedCharacter,
    _defender: DeployedCharacter,
    armorPierce: boolean,
  ): number {
    let damage = attacker.attack

    // Apply attack buffs
    for (const buff of attacker.buffs) {
      if (buff.type === 'attackBoost') {
        damage += buff.value
      }
    }

    // Apply weaken debuff (reduce attack)
    for (const debuff of attacker.debuffs) {
      if (debuff.type === 'weaken') {
        damage -= debuff.value
      }
    }

    return Math.max(0, damage)
  }

  /**
   * Apply damage to a target character, considering armor.
   * Returns the actual damage dealt.
   */
  applyDamage(
    target: DeployedCharacter,
    damage: number,
    armorPierce: boolean,
  ): number {
    if (target.state === 'retired') return 0

    let effectiveDamage = damage

    // Armor absorbs damage (unless armor-piercing)
    if (!armorPierce && target.armor > 0) {
      if (target.armor >= effectiveDamage) {
        target.armor -= effectiveDamage
        return 0
      }
      effectiveDamage -= target.armor
      target.armor = 0
    }

    // Block buffs — consumed after one hit (per rules: "即时触发，不会保留")
    for (const buff of target.buffs) {
      if (buff.type === 'block' && buff.value > 0) {
        buff.remainingTurns = 0 // consume immediately after use
        if (buff.value >= effectiveDamage) {
          buff.value -= effectiveDamage
          return 0
        }
        effectiveDamage -= buff.value
        buff.value = 0
      }
    }

    target.currentHp -= effectiveDamage

    // Check for retirement
    if (target.currentHp <= 0) {
      target.state = 'retired'
      target.currentHp = 0
    } else if (target.state !== 'nearDeath') {
      // If HP is low but not dead, check near-death via the dedicated function
      const nearDeathChance = this.checkNearDeath(target.maxHp, effectiveDamage)
      // Note: the actual near-death roll is done externally in resolveAttack
    }

    return effectiveDamage
  }

  // ----------------------------------------------------------
  // Near-death probability mechanic
  // ----------------------------------------------------------

  /**
   * Check whether a character enters near-death state.
   * Based on the difference between maxHp and remaining effective HP:
   *   difference > 5  : 1/6 chance  (need 6 on d6)
   *   difference 3-5  : 1/3 chance  (need 5-6 on d6)
   *   difference < 3  : 1/2 chance  (need 4-6 on d6)
   *
   * The "difference" here is calculated as (maxHp - currentHpAfterDamage).
   * A higher difference means the character is more wounded and more likely
   * to enter near-death.
   */
  checkNearDeath(maxHp: number, currentHp: number): boolean {
    const difference = maxHp - currentHp
    let targetNumber: number

    if (difference > 5) {
      targetNumber = 6 // 1/6 chance
    } else if (difference >= 3) {
      targetNumber = 5 // 1/3 chance (5 or 6)
    } else {
      targetNumber = 4 // 1/2 chance (4, 5, or 6)
    }

    const roll = randomInt(1, 6)
    return roll >= targetNumber
  }

  // ----------------------------------------------------------
  // Full attack resolution
  // ----------------------------------------------------------

  /**
   * Resolve an attack from one deployed character to another.
   * Full keyword pipeline: untargetable → guardian → armorPierce → damage →
   * immunity → earthStore → spread → near-death → counter → veteran
   */
  resolveAttack(
    state: GameState,
    attackerPlayerId: string,
    attackerCharUid: string,
    targetPlayerId: string,
    targetCharUid: string,
    armorPierce: boolean,
  ): { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean } {
    const attackerPlayer = findPlayer(state, attackerPlayerId)
    const targetPlayer = findPlayer(state, targetPlayerId)

    if (!attackerPlayer || !targetPlayer) {
      return { success: false, message: '未找到玩家' }
    }

    const attackerInfo = findDeployedChar(attackerPlayer, attackerCharUid)
    let targetInfo = findDeployedChar(targetPlayer, targetCharUid)

    if (!attackerInfo || !targetInfo) {
      return { success: false, message: '场上未找到该角色' }
    }

    const attacker = attackerInfo.char
    let target = targetInfo.char

    if (attacker.state === 'retired') {
      return { success: false, message: '攻击者已被击退' }
    }
    if (target.state === 'retired') {
      return { success: false, message: '目标已被击退' }
    }
    if (!attacker.hasActionPoint) {
      return { success: false, message: '攻击者本回合没有行动点了' }
    }

    // disarm: cannot attack
    const hasDisarm = attacker.debuffs.some((d) => d.type === 'disarm')
    if (hasDisarm) {
      return { success: false, message: '攻击者被缴械，无法攻击' }
    }

    // AP limit: max 3 characters per turn
    if (attackerPlayer.apUsedThisTurn >= 3) {
      return { success: false, message: '本回合已使用3名角色的行动点' }
    }

    // ---- Step 1: untargetable check ----
    if (target.keywords.includes('untargetable')) {
      return { success: false, message: `${this.getCharName(target)}不可选中` }
    }

    // ---- Step 2: guardian redirect ----
    if (!armorPierce && target.keywords.includes('guardian')) {
      // Target IS the guardian — no redirect needed
    } else if (!armorPierce) {
      // Check for adjacent guardian
      const redirected = this.findGuardian(targetPlayer, targetInfo.slotIndex)
      if (redirected) {
        target = redirected.char
        targetInfo = redirected
        addBattleLog(state, attackerPlayerId, `攻击被守护者拦截`)
      }
    }

    // ---- Step 3: attacker keyword — armorPierce ----
    const effectiveArmorPierce = armorPierce || attacker.keywords.includes('armorPierce')

    // Consume attacker's action point
    attacker.hasActionPoint = false
    attackerPlayer.apUsedThisTurn++

    const attackerDef = getCharacterDef(attacker.cardId)
    const attackerName = attackerDef?.name ?? attacker.cardId
    const targetDef = getCharacterDef(target.cardId)
    const targetName = targetDef?.name ?? target.cardId

    // ---- Step 4: immunity check ----
    if (target.keywords.includes('immunity')) {
      addBattleLog(state, attackerPlayerId, `${attackerName}攻击了${targetName}，但目标免疫伤害`)
      return {
        success: true,
        message: `${targetName}免疫了攻击`,
        nearDeathTriggered: false,
        retired: false,
      }
    }

    // ---- Step 5: calculate and apply damage ----
    const baseDamage = this.calculateDamage(attacker, target, effectiveArmorPierce)
    const actualDamage = this.applyDamage(target, baseDamage, effectiveArmorPierce)

    addBattleLog(
      state,
      attackerPlayerId,
      `${attackerName}攻击了${targetName}`,
      `伤害=${actualDamage}, 穿甲=${effectiveArmorPierce}`,
    )

    let nearDeathTriggered = false
    let retired = false

    // ---- Step 6: earthStore — keep at 1 HP ----
    if (target.currentHp <= 0 && target.keywords.includes('earthStore')) {
      target.currentHp = 1
      target.state = 'normal'
      addBattleLog(state, targetPlayerId, `${targetName}的地藏效果触发，保留1HP`)
    }

    // ---- Step 7: near-death / retirement ----
    if (target.currentHp <= 0) {
      target.state = 'retired'
      retired = true
      targetPlayer.graveyard.push({
        uid: target.uid,
        cardId: target.cardId,
        suit: 'hearts' as any,
      })
      const slot = targetPlayer.deployed[targetInfo.slotIndex]
      // Move equipment to discard pile
      if (slot.equipment) {
        targetPlayer.discardPile.push(slot.equipment)
        slot.equipment = null
      }
      slot.character = null

      addBattleLog(state, targetPlayerId, `${targetName}被击退了！`)
    } else if (target.state !== 'nearDeath' && actualDamage > 0) {
      const isNearDeath = this.checkNearDeath(target.maxHp, target.currentHp)
      if (isNearDeath) {
        target.state = 'nearDeath'
        nearDeathTriggered = true
        addBattleLog(
          state,
          targetPlayerId,
          `${targetName}进入了濒死状态！`,
          `体力=${target.currentHp}/${target.maxHp}`,
        )
      }
    }

    // ---- Step 8: spread — damage adjacent characters ----
    if (attacker.keywords.includes('spread') && actualDamage > 0) {
      this.applySpreadDamage(state, targetPlayer, targetInfo.slotIndex, actualDamage)
    }

    // ---- Step 9: counter — attacker takes damage back ----
    if (target.keywords.includes('counter') && !retired && target.state !== 'nearDeath') {
      this.applyCounterDamage(state, attacker, attackerPlayer, attackerPlayerId, attackerName)
    }

    // ---- Step 10: veteran — attacker gets +2 attack next time ----
    if (target.state === 'nearDeath' || retired) {
      // veteran triggers when this character takes damage that causes near-death/retirement
      // Actually: veteran is on the ATTACKER side — when attacker takes damage
      // Let me re-read: "受伤后下次攻击+2" — when THIS character takes damage
      // So it should check the TARGET's veteran keyword
    }
    if (actualDamage > 0 && target.keywords.includes('veteran')) {
      target.buffs.push({
        type: 'attackBoost',
        value: 2,
        remainingTurns: 1,
        source: 'veteran',
      })
      addBattleLog(state, targetPlayerId, `${targetName}的历战效果触发，下次攻击+2`)
    }

    return {
      success: true,
      message: `${attackerName}对${targetName}造成了${actualDamage}点伤害`,
      nearDeathTriggered,
      retired,
    }
  }

  // ----------------------------------------------------------
  // Keyword helpers
  // ----------------------------------------------------------

  /**
   * Find an adjacent guardian character (positions i-1 or i+1).
   */
  private findGuardian(
    player: PlayerState,
    position: number,
  ): { slotIndex: number; char: DeployedCharacter } | undefined {
    for (const offset of [-1, 1]) {
      const adj = position + offset
      if (adj >= 0 && adj < player.deployed.length) {
        const char = player.deployed[adj].character
        if (char && char.state === 'normal' && char.keywords.includes('guardian')) {
          return { slotIndex: adj, char }
        }
      }
    }
    return undefined
  }

  /**
   * Apply spread damage to adjacent characters (ignores guardian).
   */
  private applySpreadDamage(
    state: GameState,
    targetPlayer: PlayerState,
    centerIndex: number,
    damage: number,
  ): void {
    for (const offset of [-1, 1]) {
      const adj = centerIndex + offset
      if (adj >= 0 && adj < targetPlayer.deployed.length) {
        const char = targetPlayer.deployed[adj].character
        if (char && char.state === 'normal' && !char.keywords.includes('immunity')) {
          this.applyDamage(char, damage, true)
          const def = getCharacterDef(char.cardId)
          addBattleLog(
            state,
            targetPlayer.id,
            `扩散伤害：${def?.name ?? char.cardId}受到${damage}点伤害`,
          )
        }
      }
    }
  }

  /**
   * Apply counter damage — target strikes back at attacker.
   */
  private applyCounterDamage(
    state: GameState,
    attacker: DeployedCharacter,
    attackerPlayer: PlayerState,
    attackerPlayerId: string,
    attackerName: string,
  ): void {
    if (attacker.state !== 'normal') return

    const counterDamage = 1 // simplified: counter deals 1 damage
    attacker.currentHp -= counterDamage
    addBattleLog(
      state,
      attackerPlayerId,
      `反击：${attackerName}受到${counterDamage}点反击伤害`,
    )

    if (attacker.currentHp <= 0) {
      attacker.state = 'retired'
      attackerPlayer.graveyard.push({
        uid: attacker.uid,
        cardId: attacker.cardId,
        suit: 'hearts' as any,
      })
      // Find and clear slot
      for (const slot of attackerPlayer.deployed) {
        if (slot.character?.uid === attacker.uid) {
          // Move equipment to discard pile
          if (slot.equipment) {
            attackerPlayer.discardPile.push(slot.equipment)
            slot.equipment = null
          }
          slot.character = null
          break
        }
      }
      addBattleLog(state, attackerPlayerId, `${attackerName}被反击击退！`)
    }
  }

  private getCharName(char: DeployedCharacter): string {
    return getCharacterDef(char.cardId)?.name ?? char.cardId
  }

  // ----------------------------------------------------------
  // Direct player attack (when target has no deployed characters)
  // ----------------------------------------------------------

  /**
   * Resolve a direct attack on a player (bypasses deployed characters).
   */
  resolveDirectAttack(
    state: GameState,
    attackerPlayerId: string,
    attackerCharUid: string,
    targetPlayerId: string,
  ): { success: boolean; message: string; retired?: boolean } {
    const attackerPlayer = findPlayer(state, attackerPlayerId)
    const targetPlayer = findPlayer(state, targetPlayerId)

    if (!attackerPlayer || !targetPlayer) {
      return { success: false, message: '未找到玩家' }
    }

    const attackerInfo = findDeployedChar(attackerPlayer, attackerCharUid)
    if (!attackerInfo) {
      return { success: false, message: '场上未找到攻击角色' }
    }

    const attacker = attackerInfo.char
    if (attacker.state === 'retired') {
      return { success: false, message: '攻击者已被击退' }
    }
    if (!attacker.hasActionPoint) {
      return { success: false, message: '攻击者本回合没有行动点了' }
    }
    // disarm: cannot attack
    const hasDisarmDirect = attacker.debuffs.some((d) => d.type === 'disarm')
    if (hasDisarmDirect) {
      return { success: false, message: '攻击者被缴械，无法攻击' }
    }
    if (attackerPlayer.apUsedThisTurn >= 3) {
      return { success: false, message: '本回合已使用3名角色的行动点' }
    }

    // Check target has no deployed characters
    const hasDeployed = targetPlayer.deployed.some((s) => s.character && s.character.state !== 'retired')
    if (hasDeployed) {
      return { success: false, message: '目标玩家仍有场上角色，无法直接攻击' }
    }

    // Consume action point
    attacker.hasActionPoint = false
    attackerPlayer.apUsedThisTurn++

    const attackerDef = getCharacterDef(attacker.cardId)
    const attackerName = attackerDef?.name ?? attacker.cardId

    // Calculate damage (with buffs)
    let damage = attacker.attack
    for (const buff of attacker.buffs) {
      if (buff.type === 'attackBoost') {
        damage += buff.value
      }
    }

    // Apply damage to player HP
    const actualDamage = Math.min(damage, targetPlayer.hp)
    targetPlayer.hp -= actualDamage

    addBattleLog(
      state,
      attackerPlayerId,
      `${attackerName}直接攻击了${targetPlayer.name}`,
      `伤害=${actualDamage}`,
    )

    let retired = false
    if (targetPlayer.hp <= 0) {
      targetPlayer.hp = 0
      targetPlayer.isAlive = false
      retired = true
      addBattleLog(state, targetPlayerId, `${targetPlayer.name}已被淘汰！`)
    }

    return {
      success: true,
      message: `${attackerName}对${targetPlayer.name}造成了${actualDamage}点伤害`,
      retired,
    }
  }
}
