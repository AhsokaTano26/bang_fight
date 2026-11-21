// ============================================================
// Deployable (equipment) strategy card handlers
// ============================================================

import type { CardInstance, DeployedCharacter, GameState, PlayerState, StrategyCardDef } from '../types'
import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from './utils'

// ------------------------------------------------------------
// Equip a deployable strategy card to a deployed character
// ------------------------------------------------------------

export function handleEquipStrategy(ctx: StrategyContext): StrategyResult {
  const { state, player, card, def, params } = ctx
  const { targetCharUid } = params

  if (def.requiresTarget && !targetCharUid) {
    return { success: false, message: '需要指定装备目标角色' }
  }

  // Find the target character slot
  const slotInfo = findDeployedChar(player, targetCharUid!)
  if (!slotInfo) return { success: false, message: '未找到目标角色' }

  const slot = player.deployed[slotInfo.slotIndex]
  if (slot.equipment) {
    return { success: false, message: '该角色已有装备' }
  }

  // Equip the card
  slot.equipment = card

  // Apply immediate equip effects
  const char = slotInfo.char
  const effects = def.equipEffects ?? []
  const appliedEffects: string[] = []

  for (const effect of effects) {
    switch (effect.type) {
      case 'attackBoost':
        char.attack += effect.value ?? 0
        appliedEffects.push(`攻击+${effect.value}`)
        break
      case 'hpBoost':
        char.maxHp += effect.value ?? 0
        char.currentHp += effect.value ?? 0
        if (char.currentHp <= 0) {
          char.state = 'retired'
          char.currentHp = 0
          appliedEffects.push(`体力+${effect.value}（角色退场）`)
        } else {
          appliedEffects.push(`体力+${effect.value}`)
        }
        break
      case 'armorBoost':
        char.armor += effect.value ?? 0
        appliedEffects.push(`护甲+${effect.value}`)
        break
      case 'handLimitBoost':
        appliedEffects.push(`手牌上限+${effect.value}`)
        break
      case 'grantKeyword':
        if (effect.keyword && !char.keywords.includes(effect.keyword)) {
          char.keywords.push(effect.keyword)
          appliedEffects.push(`获得关键词: ${effect.keyword}`)
        }
        break
      case 'silenceImmunity':
        if (!char.keywords.includes('silenceImmunity')) {
          char.keywords.push('silenceImmunity')
        }
        appliedEffects.push('沉默免疫')
        break
      case 'armorPierceOnAttack':
        char.buffs.push({ type: 'armorPierceOnAttack', value: 1, remainingTurns: -1, source: card.uid })
        appliedEffects.push('攻击时穿甲')
        break
      case 'nearDeathRecover':
        char.buffs.push({ type: 'nearDeathRecover', value: 1, remainingTurns: -1, source: card.uid })
        appliedEffects.push('濒死恢复')
        break
      case 'unTargetable':
        if (!char.keywords.includes('untargetable')) {
          char.keywords.push('untargetable')
        }
        appliedEffects.push('不可选中')
        break
      case 'critOnAttack':
        char.buffs.push({ type: 'critOnAttack', value: 1, remainingTurns: -1, source: card.uid })
        appliedEffects.push('攻击暴击')
        break
      case 'ignoreGuardian':
        if (!char.keywords.includes('ignoreGuardian')) {
          char.keywords.push('ignoreGuardian')
        }
        appliedEffects.push('无视守护')
        break
      case 'counterSilence':
        if (!char.keywords.includes('counterSilence')) {
          char.keywords.push('counterSilence')
        }
        appliedEffects.push('反击沉默')
        break
      case 'forceRetireOnHit':
        char.buffs.push({ type: 'forceRetireOnHit', value: 1, remainingTurns: -1, source: card.uid })
        appliedEffects.push('命中时强制退场')
        break
      case 'conditionalBonus':
        char.buffs.push({
          type: 'conditionalBonus',
          value: 0,
          remainingTurns: -1,
          source: `${card.uid}:${effect.condition}`,
        })
        appliedEffects.push(`条件加成: ${effect.condition}`)
        break
      default:
        appliedEffects.push(effect.type)
        break
    }
  }

  const charName = getCharName(char)
  addLog(state, player.id, `${charName}装备了${def.name}`, appliedEffects.join(', '))
  return { success: true, message: `${charName}装备了${def.name}（${appliedEffects.join(', ')}）` }
}

// ------------------------------------------------------------
// Use equipment active effect (if any)
// ------------------------------------------------------------

export function useEquipment(
  state: GameState,
  player: PlayerState,
  charUid: string,
  params: Record<string, any>,
): { success: boolean; message: string } {
  const slotInfo = findDeployedChar(player, charUid)
  if (!slotInfo) return { success: false, message: '未找到目标角色' }

  const slot = player.deployed[slotInfo.slotIndex]
  if (!slot.equipment) return { success: false, message: '该角色没有装备' }

  const equipDef = slot.equipment.cardId
  // Equipment active effects are handled by the combat system
  // This is a placeholder for equipment that has active abilities
  return { success: false, message: '该装备没有主动效果' }
}
