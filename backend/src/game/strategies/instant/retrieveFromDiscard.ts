// D0002 回收站: Retrieve a card from discard pile

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'

export function retrieveFromDiscard(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCardUid } = params

  let card = targetCardUid
    ? player.discardPile.find(c => c.uid === targetCardUid)
    : player.discardPile[0]

  if (!card) return { success: false, message: '弃牌堆为空' }

  const idx = player.discardPile.findIndex(c => c.uid === card!.uid)
  player.discardPile.splice(idx, 1)
  player.hand.push(card)

  const charDef = getCharacterDef(card.cardId)
  const name = charDef?.name ?? card.cardId
  addLog(state, player.id, `回收站: 取回了${name}`)
  return { success: true, message: `取回了${name}` }
}
