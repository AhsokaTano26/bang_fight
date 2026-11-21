// B0005 拆弹专家: Remove a judgment card from own judgment zone

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function removeJudgment(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId } = params
  const targetPlayer = targetPlayerId
    ? state.players.find(p => p.id === targetPlayerId) ?? player
    : player

  if (targetPlayer.judgmentZone.length === 0) {
    return { success: false, message: '判定区为空' }
  }

  const removed = targetPlayer.judgmentZone.splice(0, 1)[0]
  addLog(state, player.id, `拆弹专家: 移除了判定牌`)
  return { success: true, message: `移除了判定牌` }
}
