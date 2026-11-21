// C0006 屹立不倒: Protect near-death character from dying

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function protectNearDeath(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid } = params
  if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

  const info = findDeployedChar(player, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  if (info.char.state !== 'nearDeath') {
    return { success: false, message: '该角色不在濒死状态' }
  }

  info.char.state = 'normal'
  info.char.currentHp = 1
  addLog(state, player.id, `${getCharName(info.char)}屹立不倒！`)
  return { success: true, message: `${getCharName(info.char)}从濒死中恢复` }
}
