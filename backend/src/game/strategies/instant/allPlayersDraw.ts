// C0005 恩！情！: All players draw 1 card

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function allPlayersDraw(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  let drawCount = 0
  for (const p of state.players) {
    if (p.isAlive && state.actionDeck.length > 0) {
      const drawn = state.actionDeck.splice(0, 1)
      p.hand.push(...drawn)
      drawCount += drawn.length
    }
  }

  addLog(state, player.id, `恩！情！: 所有玩家摸了${drawCount}张牌`)
  return { success: true, message: `所有玩家各摸了1张牌` }
}
