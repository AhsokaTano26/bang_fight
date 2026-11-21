// D0009 巴巴恩波神之力: Remove debuffs from a character

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function removeDebuff(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid } = params
  if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

  const info = findDeployedChar(player, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  const debuffCount = info.char.debuffs.length
  info.char.debuffs = []
  info.char.silenced = false

  addLog(state, player.id, `${getCharName(info.char)}清除了${debuffCount}个减益`)
  return { success: true, message: `清除了${debuffCount}个减益效果` }
}
