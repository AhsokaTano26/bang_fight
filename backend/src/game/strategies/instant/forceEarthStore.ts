// D0004 我是纯良: Force earthStore on an ally

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function forceEarthStore(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid } = params
  if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

  const info = findDeployedChar(player, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  // Add temporary earthStore buff for 1 turn
  info.char.buffs.push({
    type: 'earthStore',
    value: 1,
    remainingTurns: 1,
    source: 'D0004',
  })

  addLog(state, player.id, `${getCharName(info.char)}获得地藏（1回合）`)
  return { success: true, message: `${getCharName(info.char)}获得地藏（1回合）` }
}
