// A0003 禁止事项: Disarm target enemy character (disable equipment for 1 turn)

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'

export function disarmEquipment(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId, targetCharUid } = params
  if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标角色' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  const info = findDeployedChar(targetPlayer, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  const slot = targetPlayer.deployed[info.slotIndex]
  if (!slot.equipment) return { success: false, message: '该角色没有装备' }

  // Add disarm debuff for 1 turn (equipment stays but is disabled)
  info.char.debuffs.push({
    type: 'disarm',
    value: 1,
    remainingTurns: 1,
    source: 'A0003',
  })

  const charName = getCharName(info.char)
  addLog(state, player.id, `${charName}被缴械（1回合）`)
  return { success: true, message: `${charName}已被缴械（1回合）` }
}
