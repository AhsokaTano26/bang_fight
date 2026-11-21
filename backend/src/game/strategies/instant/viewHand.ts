// C0001 视奸: View target player's hand

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'

export function viewHand(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  const handInfo = targetPlayer.hand.map(c => {
    const charDef = getCharacterDef(c.cardId)
    return charDef?.name ?? c.cardId
  }).join(', ')

  addLog(state, player.id, `视奸: ${targetPlayer.name}的手牌为 [${handInfo}]`)
  return { success: true, message: `${targetPlayer.name}的手牌: [${handInfo}]` }
}
