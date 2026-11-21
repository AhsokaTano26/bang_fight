// A0015 俄罗斯轮盘: Russian roulette - both players roll, higher wins

import { addLog, randomInt, StrategyContext, StrategyResult } from '../utils'

export function russianRoulette(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  const roll1 = randomInt(1, 6)
  const roll2 = randomInt(1, 6)

  addLog(state, player.id, `俄罗斯轮盘: ${player.name}掷出${roll1}, ${targetPlayer.name}掷出${roll2}`)

  if (roll1 > roll2) {
    targetPlayer.hp -= 2
    addLog(state, player.id, `${targetPlayer.name}受到2点伤害`)
    return { success: true, message: `${targetPlayer.name}受到2点伤害（${roll1} vs ${roll2}）` }
  } else if (roll2 > roll1) {
    player.hp -= 2
    addLog(state, player.id, `${player.name}受到2点伤害`)
    return { success: true, message: `${player.name}受到2点伤害（${roll1} vs ${roll2}）` }
  } else {
    return { success: true, message: `平局！无人受伤（${roll1} vs ${roll2}）` }
  }
}
