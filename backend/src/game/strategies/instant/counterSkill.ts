// D0012 绿接粉: Counter next enemy skill

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function counterSkill(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Mark all deployed characters with a counterSkill buff
  for (const slot of player.deployed) {
    if (slot.character && slot.character.state !== 'retired') {
      slot.character.buffs.push({
        type: 'counterSkill',
        value: 1,
        remainingTurns: 1,
        source: 'D0012',
      })
    }
  }
  addLog(state, player.id, '绿接粉: 已准备反击下次技能')
  return { success: true, message: '已准备反击下次技能' }
}
