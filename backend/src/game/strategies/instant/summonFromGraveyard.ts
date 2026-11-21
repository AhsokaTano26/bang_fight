// B0006 复活赛: Summon a character from graveyard

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'
import type { DeployedCharacter } from '../../types'

export function summonFromGraveyard(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCardUid } = params

  let card = targetCardUid
    ? player.graveyard.find(c => c.uid === targetCardUid)
    : player.graveyard[0]

  if (!card) return { success: false, message: '休息室为空' }

  const charDef = getCharacterDef(card.cardId)
  if (!charDef) return { success: false, message: '该卡不是角色牌' }

  // Find empty slot
  const emptySlot = player.deployed.find(s => s.character === null)
  if (!emptySlot) return { success: false, message: '场上没有空位' }

  const idx = player.graveyard.findIndex(c => c.uid === card!.uid)
  player.graveyard.splice(idx, 1)

  const deployedChar: DeployedCharacter = {
    uid: card.uid,
    cardId: card.cardId,
    currentHp: charDef.maxHp,
    maxHp: charDef.maxHp,
    attack: charDef.attack,
    state: 'normal',
    hasActionPoint: false,
    armor: 0,
    buffs: [],
    debuffs: [],
    keywords: [...charDef.keywords],
    silenced: false,
  }

  emptySlot.character = deployedChar
  addLog(state, player.id, `复活赛: 召回了${charDef.name}`)
  return { success: true, message: `召回了${charDef.name}` }
}
