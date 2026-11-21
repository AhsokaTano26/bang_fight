// B0004 星光魔方: Draw a character card and deploy it if same faction exists

import { addLog, randomInt, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'
import type { DeployedCharacter } from '../../types'

export function drawCharAndDeploy(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  if (state.characterPool.length === 0) {
    return { success: false, message: '角色池为空' }
  }

  const idx = randomInt(0, state.characterPool.length - 1)
  const card = state.characterPool.splice(idx, 1)[0]
  const charDef = getCharacterDef(card.cardId)
  if (!charDef) return { success: false, message: '未抽到角色牌' }

  // Check if player has a deployed character from the same faction
  const hasSameFaction = player.deployed.some(s => {
    if (!s.character) return false
    const def = getCharacterDef(s.character.cardId)
    return def && def.faction === charDef.faction
  })

  if (!hasSameFaction) {
    // Discard the drawn character
    player.discardPile.push(card)
    addLog(state, player.id, `星光魔方: 抽到${charDef.name}（${charDef.faction}），但无同阵营角色，已弃置`)
    return { success: true, message: `抽到${charDef.name}，但无同阵营角色已弃置` }
  }

  // Find first empty slot
  const emptySlot = player.deployed.find(s => s.character === null)
  if (!emptySlot) {
    player.discardPile.push(card)
    return { success: false, message: '场上没有空位' }
  }

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
  addLog(state, player.id, `星光魔方: 部署了${charDef.name}`)
  return { success: true, message: `部署了${charDef.name}` }
}
