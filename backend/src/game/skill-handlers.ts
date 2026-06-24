// ============================================================
// Skill dispatch table for character active skills
// Maps SkillEffect.type → handler function
// ============================================================

import type {
  GameState,
  PlayerState,
  DeployedCharacter,
  Buff,
  Debuff,
} from './types'
import { getCharacterDef } from './character-data'

// ------------------------------------------------------------
// Skill result
// ------------------------------------------------------------

export interface SkillResult {
  success: boolean
  message: string
  damage?: number
  heal?: number
  buffs?: Buff[]
  debuffs?: Debuff[]
  special?: string
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

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

function findAllDeployedChars(player: PlayerState): { slotIndex: number; char: DeployedCharacter }[] {
  const result: { slotIndex: number; char: DeployedCharacter }[] = []
  for (let i = 0; i < player.deployed.length; i++) {
    const char = player.deployed[i].character
    if (char && char.state === 'normal') {
      result.push({ slotIndex: i, char })
    }
  }
  return result
}

function getEnemyPlayers(state: GameState, playerId: string): PlayerState[] {
  return state.players.filter((p) => p.id !== playerId && p.isAlive)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ------------------------------------------------------------
// Skill handlers
// ------------------------------------------------------------

const handlers: Record<string, (
  state: GameState,
  casterPlayerId: string,
  casterUid: string,
  targetUid?: string,
  params?: Record<string, any>,
) => SkillResult> = {

  // ---- AG1001 一直摸兜里: 无效化一次针对己方的攻击或策略牌 ----
  counterAttack: (state, casterPlayerId, casterUid) => {
    // Passive defensive: mark as ready to counter. In practice this is
    // checked during combat resolution. For now, apply a "readyToCounter" buff.
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const info = findDeployedChar(player, casterUid)
    if (!info) return { success: false, message: '未找到角色' }

    info.char.buffs.push({
      type: 'readyToCounter',
      value: 1,
      remainingTurns: 1,
      source: casterUid,
    })
    return { success: true, message: `${getCharName(info.char)}准备反击` }
  },

  // ---- AG1002 积分卡收集: 除你以外的玩家弃牌时将其中一张纳入己方手牌 ----
  stealDiscard: (state, casterPlayerId, casterUid) => {
    // Mark caster with stealDiscard buff — triggers when any enemy discards
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const info = findDeployedChar(player, casterUid)
    if (!info) return { success: false, message: '未找到角色' }

    info.char.buffs.push({
      type: 'stealDiscard',
      value: 1,
      remainingTurns: 1,
      source: casterUid,
    })
    return { success: true, message: `${getCharName(info.char)}准备窃取弃牌` }
  },

  // ---- AG1003 一呼零应: 每回合第一张手牌必定生效 ----
  firstCardGuaranteed: (state, casterPlayerId) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    player.hand[0] // just a marker; actual logic checked in playCard
    return { success: true, message: '本回合第一张手牌必定生效' }
  },

  // ---- AG1004 SOIYA: 守护+反击 (passive, handled by keyword system) ----
  guardianCounter: () => {
    return { success: false, message: '此为被动技能，通过关键词系统生效' }
  },

  // ---- AG1005 查卡: 偷取敌方随机一张手牌 ----
  stealCard: (state, casterPlayerId, casterUid) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    const enemies = getEnemyPlayers(state, casterPlayerId)
    const targetEnemy = enemies.find((e) => e.hand.length > 0)
    if (!targetEnemy) return { success: false, message: '没有可偷取的目标' }

    const idx = randomInt(0, targetEnemy.hand.length - 1)
    const stolen = targetEnemy.hand.splice(idx, 1)[0]
    player.hand.push(stolen)

    return { success: true, message: `偷取了一张手牌` }
  },

  // ---- PPP1001 CDD: 群攻 (passive, handled by keyword system) ----
  aoeAttack: () => {
    return { success: false, message: '此为被动技能，通过关键词系统生效' }
  },

  // ---- PPP1002 仓库大王: 攻击让敌方进入濒死时抽牌 (passive trigger) ----
  drawOnNearDeath: () => {
    return { success: false, message: '此为被动触发技能' }
  },

  // ---- PPP1003 迷兔花园: 召唤欧酱(1/1,守护) ----
  summon: (state, casterPlayerId, _casterUid, _targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    // Find empty slot
    const emptySlot = player.deployed.find((s) => !s.character)
    if (!emptySlot) return { success: false, message: '没有空闲的部署位置' }

    const summonParams = params?.params ?? params
    const stats = summonParams?.stats ?? { hp: 1, attack: 1 }
    const summonKeywords = summonParams?.keywords ?? ['guardian']

    const uid = `summon_${casterPlayerId}_${Date.now()}`
    const char: DeployedCharacter = {
      uid,
      cardId: 'summon_oujiang',
      currentHp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      state: 'normal',
      hasActionPoint: false,
      armor: 0,
      buffs: [],
      debuffs: [],
      keywords: summonKeywords,
      silenced: false,
    }

    emptySlot.character = char
    return { success: true, message: '召唤了欧酱' }
  },

  // ---- PPP1004 面包圣母: +1血量 +1攻击力 一回合 ----
  buffAlly: (state, casterPlayerId, casterUid, targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const target = findDeployedChar(player, targetUid ?? '')
    if (!target) return { success: false, message: '未找到目标角色' }

    const buffParams = params?.params ?? params
    const atkBoost = buffParams?.atkBoost ?? 1
    const hpBoost = buffParams?.hpBoost ?? 1
    const duration = buffParams?.duration ?? 1

    target.char.buffs.push({
      type: 'attackBoost',
      value: atkBoost,
      remainingTurns: duration,
      source: casterUid ?? '',
    })
    target.char.currentHp = Math.min(target.char.currentHp + hpBoost, target.char.maxHp)

    return { success: true, message: `攻击力+${atkBoost}, 体力+${hpBoost}` }
  },

  // ---- PPP1005 螺包狂热者: 弃一张牌+1攻击力 ----
  sacrificeForPower: (state, casterPlayerId, casterUid, _targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const info = findDeployedChar(player, casterUid)
    if (!info) return { success: false, message: '未找到角色' }

    // Discard a random card from hand
    if (player.hand.length === 0) {
      return { success: false, message: '没有手牌可弃' }
    }
    const discardIdx = randomInt(0, player.hand.length - 1)
    player.hand.splice(discardIdx, 1)

    const boostParams = params?.params ?? params
    const atkBoost = boostParams?.atkBoost ?? 1
    info.char.buffs.push({
      type: 'attackBoost',
      value: atkBoost,
      remainingTurns: 1,
      source: casterUid,
    })

    return { success: true, message: `弃牌后攻击力+${atkBoost}` }
  },

  // ---- ROS1001 压: 限制濒死恢复 (passive, global effect) ----
  nearDeathRestriction: () => {
    return { success: false, message: '此为被动全局效果' }
  },

  // ---- ROS1002 吉他店老板: 历战 (passive, handled by keyword system) ----
  veteran: () => {
    return { success: false, message: '此为被动技能，通过关键词系统生效' }
  },

  // ---- ROS1003 魅惑女神: 自身濒死，恢复一名己方濒死角色 ----
  sacrificeHealAlly: (state, casterPlayerId, casterUid, targetUid) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const casterInfo = findDeployedChar(player, casterUid)
    if (!casterInfo) return { success: false, message: '未找到角色' }

    // Self enters near-death
    casterInfo.char.state = 'nearDeath'
    casterInfo.char.currentHp = 1

    // Restore target near-death ally
    if (targetUid) {
      const targetInfo = findDeployedChar(player, targetUid)
      if (targetInfo && targetInfo.char.state === 'nearDeath') {
        targetInfo.char.state = 'normal'
        targetInfo.char.currentHp = targetInfo.char.maxHp
        return { success: true, message: `牺牲自己，恢复了${getCharName(targetInfo.char)}` }
      }
    }

    // Find any near-death ally
    const allChars = findAllDeployedChars(player)
    const nearDeath = allChars.find(
      (c) => c.char.state === 'nearDeath' && c.char.uid !== casterUid,
    )
    if (nearDeath) {
      nearDeath.char.state = 'normal'
      nearDeath.char.currentHp = nearDeath.char.maxHp
      return { success: true, message: `牺牲自己，恢复了${getCharName(nearDeath.char)}` }
    }

    return { success: true, message: '牺牲自己进入濒死状态' }
  },

  // ---- ROS1004 骑骑开花: 转移负面效果 ----
  transferDebuff: (state, casterPlayerId, casterUid) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    // Find all characters with debuffs (exclude caster)
    const allChars = findAllDeployedChars(player)
    const withDebuffs = allChars.find((c) => c.char.debuffs.length > 0 && c.char.uid !== casterUid)

    if (!withDebuffs) return { success: false, message: '没有可转移的负面效果' }

    // Transfer first debuff to caster
    const debuff = withDebuffs.char.debuffs.shift()!
    const casterInfo = findDeployedChar(player, casterUid)
    if (casterInfo) {
      const sameDebuff = casterInfo.char.debuffs.find((d) => d.type === debuff.type)
      if (sameDebuff) {
        sameDebuff.remainingTurns = -1 // permanent
      } else {
        casterInfo.char.debuffs.push(debuff)
      }
    }

    return { success: true, message: '转移了一个负面效果' }
  },

  // ---- ROS1005 大魔姬封印: 己方角色退场后沉默敌方 ----
  silenceOnDeath: () => {
    return { success: false, message: '此为被动触发技能' }
  },

  // ---- HHW1001 弦卷家的大手: 弃一张牌恢复友方1AP ----
  restoreAllyAP: (state, casterPlayerId, _casterUid, targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    // Discard a card
    if (player.hand.length === 0) {
      return { success: false, message: '没有手牌可弃' }
    }
    const discardIdx = randomInt(0, player.hand.length - 1)
    player.hand.splice(discardIdx, 1)

    // Restore AP to target
    if (targetUid) {
      const target = findDeployedChar(player, targetUid)
      if (target && !target.char.hasActionPoint) {
        target.char.hasActionPoint = true
        return { success: true, message: `恢复了${getCharName(target.char)}的行动点` }
      }
    }

    // Find first character without AP
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal' && !slot.character.hasActionPoint) {
        slot.character.hasActionPoint = true
        return { success: true, message: `恢复了一个角色的行动点` }
      }
    }

    return { success: false, message: '所有角色已有行动点' }
  },

  // ---- HHW1002 欧数尔万事: 部署时随机调整所有角色属性 ----
  randomStatAdjust: (state, _casterPlayerId, _casterUid) => {
    for (const player of state.players) {
      for (const slot of player.deployed) {
        if (slot.character && slot.character.state === 'normal') {
          const atkAdj = randomInt(-1, 1)
          slot.character.attack = Math.max(0, slot.character.attack + atkAdj)
          const hpAdj = randomInt(-1, 1)
          slot.character.currentHp = Math.max(1, Math.min(
            slot.character.currentHp + hpAdj,
            slot.character.maxHp,
          ))
        }
      }
    }
    return { success: true, message: '所有角色属性随机调整' }
  },

  // ---- PAS1001 劈瓦: 破甲 (passive, handled by keyword system) ----
  armorPierceAttack: () => {
    return { success: false, message: '此为被动技能，通过关键词系统生效' }
  },

  // ---- PAS1002 猫狗饲主: 赋予友方角色技能触发后造成额外伤害 ----
  grantSkillTrigger: (state, casterPlayerId, casterUid, targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }
    const target = findDeployedChar(player, targetUid ?? '')
    if (!target) return { success: false, message: '未找到目标角色' }

    const triggerParams = params?.params ?? params
    const bonusDamage = triggerParams?.bonusDamage ?? 1

    target.char.buffs.push({
      type: 'skillTriggerDamage',
      value: bonusDamage,
      remainingTurns: 1,
      source: casterUid,
    })

    return { success: true, message: `赋予${getCharName(target.char)}技能触发额外伤害` }
  },

  // ---- PAS1005 求雨: 从牌堆顶4张选1张 ----
  scryDraw: (state, casterPlayerId, _casterUid, _targetUid, params) => {
    const player = findPlayer(state, casterPlayerId)
    if (!player) return { success: false, message: '未找到玩家' }

    const revealParams = params?.params ?? params
    const pickCount = revealParams?.pickCount ?? 1

    // Take top 4 from action deck
    const revealCount = Math.min(4, state.actionDeck.length)
    if (revealCount === 0) return { success: false, message: '牌堆为空' }

    const revealed = state.actionDeck.splice(0, revealCount)
    // For AI simplicity, just pick the first one; for human, would need UI
    const picked = revealed.splice(0, pickCount)
    player.hand.push(...picked)

    // Put remaining back at bottom
    state.actionDeck.push(...revealed)

    return { success: true, message: `查看了${revealCount}张牌，选取了${pickCount}张` }
  },
}

// ------------------------------------------------------------
// Helper: get character display name
// ------------------------------------------------------------

function getCharName(char: DeployedCharacter): string {
  const def = getCharacterDef(char.cardId)
  return def?.name ?? char.cardId
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Execute a skill by its effect type.
 */
export function executeSkill(
  state: GameState,
  casterPlayerId: string,
  casterUid: string,
  effectType: string,
  targetUid?: string,
  params?: Record<string, any>,
): SkillResult {
  // Check silence
  const player = findPlayer(state, casterPlayerId)
  if (player) {
    const caster = findDeployedChar(player, casterUid)
    if (caster && caster.char.silenced) {
      return { success: false, message: '角色被沉默，无法使用技能' }
    }
  }

  const handler = handlers[effectType]
  if (!handler) {
    return { success: false, message: `未知技能类型: ${effectType}` }
  }

  return handler(state, casterPlayerId, casterUid, targetUid, params)
}
