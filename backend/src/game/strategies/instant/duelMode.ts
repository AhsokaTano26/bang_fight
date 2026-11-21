// A0005 无限制live格斗: Duel mode - both discard attack cards, loser's character retires

import { addLog, findDeployedChar, getCharName, StrategyContext, StrategyResult } from '../utils'
import { STRATEGY_CARDS } from '../../strategy-data'

export function duelMode(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetPlayerId, targetCharUid } = params
  if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

  const targetPlayer = state.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

  // Count strategy cards (any type) in hand as "attack cards" for duel
  const isStrategyCard = (cardId: string) => STRATEGY_CARDS.some(sc => sc.id === cardId)

  const playerStrategyCards = player.hand.filter(c => isStrategyCard(c.cardId))
  const targetStrategyCards = targetPlayer.hand.filter(c => isStrategyCard(c.cardId))

  // Each discards up to 2 strategy cards
  const playerDiscardCount = Math.min(2, playerStrategyCards.length)
  const targetDiscardCount = Math.min(2, targetStrategyCards.length)

  for (let i = 0; i < playerDiscardCount; i++) {
    const idx = player.hand.indexOf(playerStrategyCards[i])
    if (idx !== -1) player.discardPile.push(player.hand.splice(idx, 1)[0])
  }
  for (let i = 0; i < targetDiscardCount; i++) {
    const idx = targetPlayer.hand.indexOf(targetStrategyCards[i])
    if (idx !== -1) targetPlayer.discardPile.push(targetPlayer.hand.splice(idx, 1)[0])
  }

  const diff = playerDiscardCount - targetDiscardCount
  if (diff > 0) {
    // Winner: retire one of the loser's deployed characters
    const loserChar = targetCharUid ? findDeployedChar(targetPlayer, targetCharUid) : null
    if (loserChar && loserChar.char.state !== 'retired') {
      loserChar.char.state = 'retired'
      loserChar.char.currentHp = 0
      addLog(state, player.id, `格斗对决胜利！${getCharName(loserChar.char)}退场`)
      return { success: true, message: `格斗对决胜利！${getCharName(loserChar.char)}退场` }
    }
    addLog(state, player.id, `格斗对决胜利！（弃${playerDiscardCount}张 vs ${targetDiscardCount}张）`)
    return { success: true, message: `格斗对决胜利！` }
  } else if (diff < 0) {
    // Loser: one of the player's characters retires
    const myChars = player.deployed.filter(s => s.character && s.character.state !== 'retired')
    if (myChars.length > 0) {
      const victim = myChars[0].character!
      victim.state = 'retired'
      victim.currentHp = 0
      addLog(state, player.id, `格斗对决失败！${getCharName(victim)}退场`)
      return { success: true, message: `格斗对决失败！${getCharName(victim)}退场` }
    }
    addLog(state, player.id, `格斗对决失败！（弃${playerDiscardCount}张 vs ${targetDiscardCount}张）`)
    return { success: true, message: `格斗对决失败！` }
  } else {
    addLog(state, player.id, `格斗对决: 平局（各弃${playerDiscardCount}张）`)
    return { success: true, message: '格斗对决平局' }
  }
}
