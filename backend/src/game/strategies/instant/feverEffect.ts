// C0015 Fever!!!!!: Special effect if 5 characters of same faction

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'

export function feverEffect(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  // Check if player has 5 characters of the same faction
  const factionCounts: Record<string, number> = {}
  for (const slot of player.deployed) {
    if (slot.character) {
      const def = getCharacterDef(slot.character.cardId)
      if (def) {
        factionCounts[def.faction] = (factionCounts[def.faction] ?? 0) + 1
      }
    }
  }

  const maxFaction = Object.entries(factionCounts).sort((a, b) => b[1] - a[1])[0]
  if (maxFaction && maxFaction[1] >= 5) {
    // Full fever: heal all + buff all
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        const def = getCharacterDef(slot.character.cardId)
        slot.character.currentHp = def?.maxHp ?? slot.character.maxHp
        slot.character.buffs.push({ type: 'attackBoost', value: 2, remainingTurns: 2, source: 'fever' })
      }
    }
    addLog(state, player.id, 'Fever!!!!!: 5名同阵营角色！全队回满+攻击+2')
    return { success: true, message: 'Fever!!!!! 全队回满+攻击+2' }
  }

  addLog(state, player.id, 'Fever!!!!!: 未达成5名同阵营角色条件')
  return { success: false, message: 'Fever!!!!! 未达成条件（需要5名同阵营角色）' }
}
