// B0003 轨迹展: Retrieve an instant card from discard pile

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { STRATEGY_CARDS } from '../../strategy-data'

export function retrieveInstantFromDiscard(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  const instantCards = player.discardPile.filter(c => {
    const def = STRATEGY_CARDS.find(sc => sc.id === c.cardId)
    return def?.strategyType === 'instant'
  })

  if (instantCards.length === 0) {
    return { success: false, message: '弃牌堆中没有即时牌' }
  }

  // Take the first instant card from discard
  const card = instantCards[0]
  const idx = player.discardPile.findIndex(c => c.uid === card.uid)
  player.discardPile.splice(idx, 1)
  player.hand.push(card)

  addLog(state, player.id, `从弃牌堆取回了一张即时牌`)
  return { success: true, message: `取回了一张即时牌` }
}
