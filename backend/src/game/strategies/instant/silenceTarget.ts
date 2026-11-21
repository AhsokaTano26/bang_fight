// B0016 是不想说话吗: Silence a target character (1/2 probability)

import { addLog, findDeployedChar, getCharName, randomInt, StrategyContext, StrategyResult } from '../utils'

export function silenceTarget(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId, targetCharUid } = params
  if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  const info = findDeployedChar(targetPlayer, targetCharUid)
  if (!info) return { success: false, message: '未找到目标角色' }

  // Check silence immunity
  if (info.char.keywords.includes('silenceImmunity') || info.char.buffs.some(b => b.type === 'silenceImmunity')) {
    addLog(state, player.id, `${getCharName(info.char)}免疫沉默`)
    return { success: true, message: `${getCharName(info.char)}免疫沉默` }
  }

  // 1/2 probability check (>= 3 on d6)
  const roll = randomInt(1, 6)
  if (roll < 3) {
    addLog(state, player.id, `沉默判定失败（掷骰${roll}）`)
    return { success: true, message: `沉默判定失败（掷骰${roll}）` }
  }

  info.char.silenced = true
  info.char.debuffs.push({
    type: 'silence',
    value: 1,
    remainingTurns: 1,
    source: 'silenceCard',
  })

  addLog(state, player.id, `${getCharName(info.char)}被沉默（掷骰${roll}）`)
  return { success: true, message: `${getCharName(info.char)}已被沉默` }
}
