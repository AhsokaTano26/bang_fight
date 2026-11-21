// D0011 啥是XXX / C0011 不仲蕾: Disable faction skill

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function disableFactionSkill(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  // Set faction skill disabled flag on the player (not individual character silence)
  targetPlayer.factionSkillDisabled = true

  addLog(state, player.id, `${targetPlayer.name}的阵营技能被禁用`)
  return { success: true, message: `${targetPlayer.name}的阵营技能被禁用` }
}
