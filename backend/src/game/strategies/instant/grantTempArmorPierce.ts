// A0014 巧克力螺: Grant temporary armor pierce to an ally

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function grantTempArmorPierce(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid } = params
  if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

  const info = findDeployedChar(player, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  info.char.buffs.push({
    type: 'armorPierceOnAttack',
    value: 1,
    remainingTurns: 1,
    source: 'chocolateScrew',
  })

  addLog(state, player.id, `${getCharName(info.char)}获得临时穿甲`)
  return { success: true, message: `${getCharName(info.char)}获得临时穿甲` }
}
