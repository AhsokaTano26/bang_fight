// B0010 阿提斯特: Grant crit to an ally

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function grantCrit(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid } = params
  if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

  const info = findDeployedChar(player, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  info.char.buffs.push({
    type: 'critOnAttack',
    value: 2,
    remainingTurns: 2,
    source: 'artist',
  })

  addLog(state, player.id, `${getCharName(info.char)}获得暴击buff`)
  return { success: true, message: `${getCharName(info.char)}获得暴击` }
}
