// B0012 何意味: Swap a random hand card with each other player

import { addLog, randomInt, StrategyContext, StrategyResult } from '../utils'

export function swapHandWithPlayers(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  const otherPlayers = state.players.filter(p => p.id !== player.id && p.isAlive)
  let swapCount = 0

  for (const other of otherPlayers) {
    if (player.hand.length === 0 || other.hand.length === 0) continue

    const myIdx = randomInt(0, player.hand.length - 1)
    const otherIdx = randomInt(0, other.hand.length - 1)

    const myCard = player.hand.splice(myIdx, 1)[0]
    const otherCard = other.hand.splice(otherIdx, 1)[0]

    player.hand.push(otherCard)
    other.hand.push(myCard)
    swapCount++
  }

  addLog(state, player.id, `何意味: 与${swapCount}名玩家交换了手牌`)
  return { success: true, message: `与${swapCount}名玩家交换了手牌` }
}
