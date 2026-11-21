// B0002 五字不行: Place judgment + pass action

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function placeJudgmentPass(ctx: StrategyContext): StrategyResult {
  const { state, player, card, def, params } = ctx
  const { targetPlayerId } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  targetPlayer.judgmentZone.push(card)
  addLog(state, player.id, `对${targetPlayer.name}放置了判定牌: ${def.name}`)
  return { success: true, message: `已对${targetPlayer.name}放置判定牌`, skipDiscard: true }
}
