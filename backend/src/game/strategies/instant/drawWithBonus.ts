// E0001-E0012 麻里奈的礼物箱: Draw 2 cards, if same suit draw 1 more

import { addLog, StrategyContext, StrategyResult } from '../utils'
import type { CardInstance } from '../../types'

export function drawWithBonus(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  if (state.actionDeck.length < 2) {
    // Reshuffle discard piles into deck
    const allDiscarded: CardInstance[] = []
    for (const p of state.players) {
      allDiscarded.push(...p.discardPile)
      p.discardPile = []
    }
    state.actionDeck.push(...allDiscarded)
    // Shuffle
    for (let i = state.actionDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.actionDeck[i], state.actionDeck[j]] = [state.actionDeck[j], state.actionDeck[i]]
    }
  }

  const drawn = state.actionDeck.splice(0, 2)
  player.hand.push(...drawn)

  let message = `摸了2张牌`

  // Check if both cards have the same suit
  if (drawn.length === 2 && drawn[0].suit === drawn[1].suit) {
    if (state.actionDeck.length === 0) {
      // Reshuffle again if needed
      const allDiscarded: CardInstance[] = []
      for (const p of state.players) {
        allDiscarded.push(...p.discardPile)
        p.discardPile = []
      }
      state.actionDeck.push(...allDiscarded)
      for (let i = state.actionDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.actionDeck[i], state.actionDeck[j]] = [state.actionDeck[j], state.actionDeck[i]]
      }
    }
    const bonus = state.actionDeck.splice(0, 1)
    player.hand.push(...bonus)
    message = `摸了2张牌（花色相同），额外摸了1张`
  }

  addLog(state, player.id, `麻里奈的礼物箱: ${message}`)
  return { success: true, message }
}
