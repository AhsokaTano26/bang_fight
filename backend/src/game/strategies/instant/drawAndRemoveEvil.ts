// D0006 禁止947: Draw cards and remove evil cards

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function drawAndRemoveEvil(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  if (state.actionDeck.length > 0) {
    const drawn = state.actionDeck.splice(0, Math.min(2, state.actionDeck.length))
    player.hand.push(...drawn)
    addLog(state, player.id, `禁止947: 摸了${drawn.length}张牌`)
    return { success: true, message: `摸了${drawn.length}张牌` }
  }
  return { success: false, message: '牌堆为空' }
}
