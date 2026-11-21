// A0004 财团B的阴谋: Discard an undeployed character from enemy hand

import { addLog, StrategyContext, StrategyResult } from '../utils'
import { getCharacterDef } from '../../character-data'

export function discardUndeployedChar(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId, targetCardUid } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find((p) => p.id === targetPlayerId)
  if (!targetPlayer || !targetPlayer.isAlive)
    return { success: false, message: '未找到存活的目标玩家' }

  // Hidden identities stay inside rule resolution. With no explicit revealed-card
  // choice, use the first eligible character; policy and UI need only a player ID.
  const idx = targetPlayer.hand.findIndex(
    (c) => (!targetCardUid || c.uid === targetCardUid) && getCharacterDef(c.cardId),
  )
  if (idx === -1) return { success: false, message: '目标手牌中没有可送入休息室的角色' }

  const card = targetPlayer.hand.splice(idx, 1)[0]
  targetPlayer.graveyard.push(card)

  const charDef = getCharacterDef(card.cardId)
  addLog(
    state,
    player.id,
    `${targetPlayer.name}的一名未部署角色进入休息室`,
    charDef?.name ?? card.cardId,
  )
  return { success: true, message: `已将${targetPlayer.name}的一名角色送入休息室` }
}
