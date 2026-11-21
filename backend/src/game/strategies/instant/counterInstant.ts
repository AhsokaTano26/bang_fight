// A0008 我有异议: Counter an instant card

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function counterInstant(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Mark all deployed characters with a counterInstant buff
  for (const slot of player.deployed) {
    if (slot.character && slot.character.state !== 'retired') {
      slot.character.buffs.push({
        type: 'counterInstant',
        value: 1,
        remainingTurns: 1,
        source: 'A0008',
      })
    }
  }
  addLog(state, player.id, '使用了我有异议（下次对手即时牌失效）')
  return { success: true, message: '已使用我有异议：下次对手即时牌失效' }
}
