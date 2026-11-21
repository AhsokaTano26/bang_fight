// A0016 小星星无限loop: Suit judgment, draw based on result

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function suitJudgmentDraw(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Simple suit judgment - random suit
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const
  const suit = suits[Math.floor(Math.random() * suits.length)]

  // Happy = hearts/diamonds, Powerful = spades only
  const isHappy = suit === 'hearts' || suit === 'diamonds'
  const isPowerful = suit === 'spades'

  let drawCount = 1
  if (isHappy) drawCount = 3
  else if (isPowerful) drawCount = 0 // Powerful: return hand + draw suit card (simplified)

  if (drawCount > 0 && state.actionDeck.length > 0) {
    const drawn = state.actionDeck.splice(0, drawCount)
    player.hand.push(...drawn)
  }

  addLog(state, player.id, `小星星无限loop: 花色=${suit}, 摸${drawCount}张`)
  return { success: true, message: `花色判定: ${suit}, 摸${drawCount}张牌` }
}
