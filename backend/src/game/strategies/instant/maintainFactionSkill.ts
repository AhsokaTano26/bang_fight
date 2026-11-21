// A0011 世界守护者: Maintain faction skill — re-enable faction skill

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function maintainFactionSkill(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Clear faction skill disabled flag
  player.factionSkillDisabled = false

  // Also grant silence immunity to all own characters for 3 turns
  for (const slot of player.deployed) {
    if (slot.character && slot.character.state === 'normal') {
      slot.character.buffs.push({
        type: 'silenceImmunity',
        value: 1,
        remainingTurns: 3,
        source: 'worldGuardian',
      })
    }
  }
  addLog(state, player.id, '世界守护者: 阵营技恢复+全队沉默免疫3回合')
  return { success: true, message: '阵营技恢复+全队沉默免疫3回合' }
}
