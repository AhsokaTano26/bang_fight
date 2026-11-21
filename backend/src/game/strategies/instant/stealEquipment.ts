// A0012 拿来吧你: Steal equipment from enemy

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function stealEquipment(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId, targetCharUid, targetAllyCharUid } = params
  if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  const targetInfo = findDeployedChar(targetPlayer, targetCharUid)
  if (!targetInfo) return { success: false, message: '未找到目标角色' }

  const targetSlot = targetPlayer.deployed[targetInfo.slotIndex]
  if (!targetSlot.equipment) return { success: false, message: '目标角色没有装备' }

  // Find ally to equip to
  const allyInfo = targetAllyCharUid ? findDeployedChar(player, targetAllyCharUid) : null
  if (allyInfo) {
    const allySlot = player.deployed[allyInfo.slotIndex]
    if (allySlot.equipment) return { success: false, message: '友方角色已有装备' }
    allySlot.equipment = targetSlot.equipment
    targetSlot.equipment = null
    addLog(state, player.id, `偷取了${getCharName(targetInfo.char)}的装备给${getCharName(allyInfo.char)}`)
    return { success: true, message: '装备已偷取' }
  } else {
    // No ally specified, add to hand
    const equip = targetSlot.equipment!
    targetSlot.equipment = null
    player.hand.push(equip)
    addLog(state, player.id, `偷取了${getCharName(targetInfo.char)}的装备`)
    return { success: true, message: '装备已偷取到手牌' }
  }
}
