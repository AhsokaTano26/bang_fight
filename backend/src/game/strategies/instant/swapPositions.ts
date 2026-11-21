// B0015 灵魂互换: Swap positions of two deployed characters

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function swapPositions(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { charUid1, charUid2 } = params
  if (!charUid1 || !charUid2) return { success: false, message: '需要指定两个角色' }

  const info1 = findDeployedChar(player, charUid1)
  const info2 = findDeployedChar(player, charUid2)
  if (!info1 || !info2) return { success: false, message: '未找到目标角色' }

  // Swap characters between slots
  const char1 = player.deployed[info1.slotIndex].character
  const char2 = player.deployed[info2.slotIndex].character
  player.deployed[info1.slotIndex].character = char2
  player.deployed[info2.slotIndex].character = char1

  addLog(state, player.id, `灵魂互换: ${getCharName(info1.char)} ↔ ${getCharName(info2.char)}`)
  return { success: true, message: '位置已互换' }
}
