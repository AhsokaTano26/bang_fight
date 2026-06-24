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

    // Block buffs
    for (const buff of target.buffs) {
      if (buff.type === 'block' && buff.value > 0) {
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
   * Handles damage, armor, near-death check, and retirement.
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
      return { success: false, message: 'Player not found' }
    }

    const attackerInfo = findDeployedChar(attackerPlayer, attackerCharUid)
    const targetInfo = findDeployedChar(targetPlayer, targetCharUid)

    if (!attackerInfo || !targetInfo) {
      return { success: false, message: 'Character not found on the field' }
    }

    const attacker = attackerInfo.char
    const target = targetInfo.char

    if (attacker.state === 'retired') {
      return { success: false, message: 'Attacker is retired' }
    }
    if (target.state === 'retired') {
      return { success: false, message: 'Target is already retired' }
    }
    if (!attacker.hasActionPoint) {
      return { success: false, message: 'Attacker has no action point this turn' }
    }

    // Consume attacker's action point
    attacker.hasActionPoint = false

    // Calculate base damage
    const baseDamage = this.calculateDamage(attacker, target, armorPierce)
    const attackerDef = getCharacterDef(attacker.cardId)
    const attackerName = attackerDef?.name ?? attacker.cardId
    const targetDef = getCharacterDef(target.cardId)
    const targetName = targetDef?.name ?? target.cardId

    // Apply damage
    const actualDamage = this.applyDamage(target, baseDamage, armorPierce)

    addBattleLog(
      state,
      attackerPlayerId,
      `${attackerName} attacks ${targetName}`,
      `damage=${actualDamage}, armorPierce=${armorPierce}`,
    )

    let nearDeathTriggered = false
    let retired = false

    // Check near-death / retirement (use HP since state was narrowed by earlier checks)
    if (target.currentHp <= 0) {
      target.state = 'retired'
      retired = true
      // Move character to graveyard
      targetPlayer.graveyard.push({
        uid: target.uid,
        cardId: target.cardId,
        suit: 'hearts' as any, // suit is not critical for graveyard
      })
      // Clear the deployed slot
      const slot = targetPlayer.deployed[targetInfo.slotIndex]
      slot.character = null
      slot.equipment = null

      addBattleLog(
        state,
        targetPlayerId,
        `${targetName} retired!`,
      )
    } else if (target.state !== 'nearDeath' && actualDamage > 0) {
      // Roll for near-death
      const isNearDeath = this.checkNearDeath(target.maxHp, target.currentHp)
      if (isNearDeath) {
        target.state = 'nearDeath'
        nearDeathTriggered = true

        addBattleLog(
          state,
          targetPlayerId,
          `${targetName} enters near-death!`,
          `HP=${target.currentHp}/${target.maxHp}`,
        )
      }
    }

    return {
      success: true,
      message: `${attackerName} dealt ${actualDamage} damage to ${targetName}`,
      nearDeathTriggered,
      retired,
    }
  }
}
