// B0011 诡异的蘑菇: Unlimited AP this turn

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function unlimitedApThisTurn(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Refresh all character AP and remove AP limit this turn
  for (const slot of player.deployed) {
    if (slot.character && slot.character.state === 'normal') {
      slot.character.hasActionPoint = true
    }
  }
  player.apUsedThisTurn = 0

  addLog(state, player.id, '诡异的蘑菇: 本回合行动点无限')
  return { success: true, message: '本回合行动点无限' }
}
