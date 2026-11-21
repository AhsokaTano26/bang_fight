// ============================================================
// Main game orchestration service
// ============================================================

import { Injectable } from '@nestjs/common'
import { DeckService } from './deck.service'
import { CombatService } from './combat.service'
import { GameStateService } from './game-state.service'
import { DiceService } from './dice.service'
import { CHARACTER_CARDS, getCharacterDef } from './character-data'
import { executeSkill } from './skill-handlers'
import { canUseAp } from './ai/combat-model'
import { handleEquipStrategy, executeInstantStrategy, findDeployedChar, getCharName } from './strategies'
import type {
  BattleLogEntry,
  CardInstance,
  DeployedCharacter,
  DeployedSlot,
  EquipEffect,
  GameAction,
  GameState,
  KeywordType,
  PlayerState,
  StrategyCardDef,
  TurnPhase,
} from './types'

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function randomId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  return Array.from({ length: 36 }, (_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return '-'
    return hex()
  }).join('')
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function now(): number {
  return Date.now()
}

function addLog(
  state: GameState,
  playerId: string,
  action: string,
  details?: string,
): void {
  state.battleLog.push({
    turn: state.turnNumber,
    phase: state.turnPhase as TurnPhase,
    playerId,
    action,
    details,
    timestamp: now(),
  })
}

// ------------------------------------------------------------
// Service
// ------------------------------------------------------------

@Injectable()
export class GameService {
  constructor(
    private readonly deckService: DeckService,
    private readonly combatService: CombatService,
    private readonly stateService: GameStateService,
    private readonly diceService: DiceService,
  ) {}

  // ----------------------------------------------------------
  // createGame
  // ----------------------------------------------------------

  /**
   * Create a new game.
   * 1. Build the character pool (20 characters, shuffled)
   * 2. Build the action deck (28 action cards, shuffled)
   * 3. Create player states
   * 4. Deal 5 character cards to each player for drafting
   * 5. Each player "deploys" their first character at position 0
   * 6. Draw 5 action cards per player
   */
  createGame(playerCount: number, aiCount: number): GameState {
    const gameId = randomId()

    // 1. Character pool
    const characterPool = this.createCharacterPool()

    // 2. Mixed deck (action + strategy cards)
    const actionDeck = this.deckService.createMixedDeck()

    // 3. Create players
    const players: PlayerState[] = []
    for (let i = 0; i < playerCount; i++) {
      players.push(this.createPlayer(`player_${i}`, `Player ${i + 1}`, false))
    }
    for (let i = 0; i < aiCount; i++) {
      players.push(this.createPlayer(`ai_${i}`, `AI ${i + 1}`, true))
    }

    const state: GameState = {
      gameId,
      players,
      currentPlayerIndex: 0,
      turnNumber: 1,
      turnPhase: 'draw',
      characterPool,
      actionDeck,
      strategyDeck: [],
      pendingEffects: [],
      battleLog: [],
      winner: null,
      gameOver: false,
    }

    // 4. Deal 5 character cards to each player
    for (const player of players) {
      const { drawn, remaining } = this.deckService.drawCards(state.characterPool, 5)
      player.hand.push(...drawn)
      state.characterPool = remaining
    }

    // 5. Each player deploys their first character (the first card in hand)
    for (const player of players) {
      if (player.hand.length > 0) {
        const cardToDeploy = player.hand[0]
        const charDef = getCharacterDef(cardToDeploy.cardId)
        if (charDef) {
          const deployedChar: DeployedCharacter = {
            uid: cardToDeploy.uid,
            cardId: cardToDeploy.cardId,
            currentHp: charDef.maxHp,
            maxHp: charDef.maxHp,
            attack: charDef.attack,
            state: 'normal',
            hasActionPoint: true,
            armor: 0,
            buffs: [],
            debuffs: [],
            keywords: [...charDef.keywords],
            silenced: false,
          }

          player.deployed[0] = {
            position: 0,
            character: deployedChar,
            equipment: null,
          }

          // Remove the deployed card from hand
          player.hand = player.hand.filter((c) => c.uid !== cardToDeploy.uid)
        }
      }
    }

    // 6. Draw 5 action cards per player
    for (const player of players) {
      const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 5)
      player.hand.push(...drawn)
      state.actionDeck = remaining
    }

    addLog(state, 'system', '游戏创建', `${playerCount}名玩家, ${aiCount}名AI`)
    this.stateService.create(gameId, state)
    return state
  }

  // ----------------------------------------------------------
  // startTurn
  // ----------------------------------------------------------

  /**
   * Handle the start of a new turn for the current player.
   * - Refresh action points for all deployed characters
   * - If any character is near-death, roll for recovery
   * - Increment turn number (when wrapping around to first player)
   */
  startTurn(state: GameState): GameState {
    const player = state.players[state.currentPlayerIndex]
    state.turnPhase = 'judgment'
    player.apUsedThisTurn = 0
    player.replacementCountThisTurn = 0 // V1.1: Reset replacement count

    addLog(state, player.id, `${player.name}的第${state.turnNumber}回合开始`)

    // ---- Judgment phase: resolve judgment zone cards ----
    if (player.judgmentZone.length > 0) {
      addLog(state, player.id, `判定阶段: ${player.judgmentZone.length}张判定牌`)
      const cardsToPass: CardInstance[] = []
      const cardsToDiscard: CardInstance[] = []

      for (const judgmentCard of player.judgmentZone) {
        const def = this.deckService.getStrategyCardDef(judgmentCard.cardId)
        if (def?.judgmentEffect) {
          const result = this.resolveJudgment(state, player, judgmentCard, def)
          if (result === 'moveToNext') {
            cardsToPass.push(judgmentCard)
          } else {
            cardsToDiscard.push(judgmentCard)
          }
        } else {
          cardsToDiscard.push(judgmentCard)
        }
      }

      // Discard resolved cards
      player.discardPile.push(...cardsToDiscard)
      // Pass moveToNext cards to next player's judgment zone
      if (cardsToPass.length > 0) {
        const nextIdx = (state.currentPlayerIndex + 1) % state.players.length
        const nextPlayer = state.players[nextIdx]
        nextPlayer.judgmentZone.push(...cardsToPass)
        addLog(state, player.id, `传递${cardsToPass.length}张判定牌给${nextPlayer.name}`)
      }
      player.judgmentZone = []
    }

    state.turnPhase = 'draw'

    // Near-death recovery: automatically restore near-death characters to normal state
    // Rules: "每次进入己方回合时会将濒死状态的角色刷新为正常状态"
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'nearDeath') {
        slot.character.state = 'normal'
        addLog(
          state,
          player.id,
          `${this.getCharName(slot.character)}从濒死中恢复为正常状态`,
        )
      }
    }

    // Refresh action points for this player's deployed characters (after recovery)
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        slot.character.hasActionPoint = true
      }
    }

    // loseAbility: all deployed characters lose action points
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        const hasLoseAbility = slot.character.debuffs.some((d) => d.type === 'loseAbility')
        if (hasLoseAbility) {
          slot.character.hasActionPoint = false
          addLog(state, player.id, `${this.getCharName(slot.character)}因失去行动能力，无法行动`)
        }
      }
    }

    // Decrement buff/debuff timers for this player's characters
    for (const slot of player.deployed) {
      if (slot.character) {
        slot.character.buffs = slot.character.buffs
          .map((b) => b.remainingTurns > 0 ? { ...b, remainingTurns: b.remainingTurns - 1 } : b)
          .filter((b) => b.remainingTurns !== 0)
        slot.character.debuffs = slot.character.debuffs
          .map((d) => d.remainingTurns > 0 ? { ...d, remainingTurns: d.remainingTurns - 1 } : d)
          .filter((d) => d.remainingTurns !== 0)
        // Reset silenced flag if no silence debuff remains
        if (!slot.character.debuffs.some(d => d.type === 'silence')) {
          slot.character.silenced = false
        }
      }
    }

    return state
  }

  // ----------------------------------------------------------
  // drawPhase
  // ----------------------------------------------------------

  /**
   * Draw phase: draw 2 cards from the action deck.
   * If the deck is empty, reshuffle all discard piles back in.
   */
  drawPhase(state: GameState): GameState {
    const player = state.players[state.currentPlayerIndex]
    state.turnPhase = 'draw'

    // skipDraw: if any deployed character has skipDraw debuff, skip drawing
    const hasSkipDraw = player.deployed.some(
      (s) => s.character && s.character.debuffs.some((d) => d.type === 'skipDraw'),
    )
    if (hasSkipDraw) {
      state.turnPhase = 'action'
      addLog(state, player.id, `因跳过摸牌效果，跳过了摸牌阶段`)
      return state
    }

    // Reshuffle if deck is empty
    if (state.actionDeck.length === 0) {
      this.reshuffleDeck(state)
    }

    const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 2)
    player.hand.push(...drawn)
    state.actionDeck = remaining

    // Refresh action points
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        slot.character.hasActionPoint = true
      }
    }

    state.turnPhase = 'action'
    addLog(state, player.id, `摸了${drawn.length}张牌`, `手牌=${player.hand.length}`)

    return state
  }

  // ----------------------------------------------------------
  // deployCharacter
  // ----------------------------------------------------------

  /**
   * Deploy a character card from the player's hand to a field position (0-4).
   */
  deployCharacter(
    state: GameState,
    playerId: string,
    cardUid: string,
    position: number,
  ): { success: boolean; message: string } {
    const invalid = this.combatService.validateActor(state, playerId)
    if (invalid) return { success: false, message: invalid }
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    if (position < 0 || position >= 5) {
      return { success: false, message: '无效位置（必须为0-4）' }
    }

    // Find the card in hand
    const cardIndex = player.hand.findIndex((c) => c.uid === cardUid)
    if (cardIndex === -1) {
      return { success: false, message: '手牌中未找到该卡牌' }
    }

    const card = player.hand[cardIndex]
    const charDef = getCharacterDef(card.cardId)
    if (!charDef) {
      return { success: false, message: '该卡牌不是角色牌' }
    }

    // Check if position is already occupied
    if (player.deployed[position]?.character) {
      return { success: false, message: '该位置已被占用' }
    }

    // Deploy
    const deployedChar: DeployedCharacter = {
      uid: card.uid,
      cardId: card.cardId,
      currentHp: charDef.maxHp,
      maxHp: charDef.maxHp,
      attack: charDef.attack,
      state: 'normal',
      hasActionPoint: true,
      armor: 0,
      buffs: [],
      debuffs: [],
      keywords: [...charDef.keywords],
      silenced: false,
    }

    player.deployed[position] = {
      position,
      character: deployedChar,
      equipment: null,
    }

    // Remove from hand
    player.hand.splice(cardIndex, 1)

    addLog(state, playerId, `部署了${charDef.name}到位置${position}`)

    return { success: true, message: `已部署${charDef.name}` }
  }

  // ----------------------------------------------------------
  // playCard
  // ----------------------------------------------------------

  /**
   * Play an action card from the player's hand.
   *
   * Supported action types:
   *   - attack:         Deal damage to a single target character
   *   - armorPierce:    Deal damage ignoring armor
   *   - bigBlock:       Grant block buff to all own characters
   *   - smallBlock:     Grant block buff to a single character
   *   - recovery:       Heal a single character
   *   - bigRecovery:    Heal all own characters
   *   - replenish:      Draw 2 additional cards
   */
  playCard(
    state: GameState,
    playerId: string,
    cardUid: string,
    params: Record<string, any>,
  ): { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean } {
    const invalid = this.combatService.validateActor(state, playerId)
    if (invalid) return { success: false, message: invalid }
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    if (state.turnPhase !== 'action') {
      return { success: false, message: '只能在行动阶段使用卡牌' }
    }

    // skipAction: if any deployed character has skipAction debuff, skip action
    const hasSkipAction = player.deployed.some(
      (s) => s.character && s.character.debuffs.some((d) => d.type === 'skipAction'),
    )
    if (hasSkipAction) {
      return { success: false, message: '因跳过行动效果，无法使用卡牌' }
    }

    // Find card in hand
    const cardIndex = player.hand.findIndex((c) => c.uid === cardUid)
    if (cardIndex === -1) {
      return { success: false, message: '手牌中未找到该卡牌' }
    }

    // Reserve the played card before handlers draw, exchange or discard hand cards.
    const card = player.hand.splice(cardIndex, 1)[0]

    // Strategy card branch
    const strategyDef = this.deckService.getStrategyCardDef(card.cardId)
    if (strategyDef) {
      let result: { success: boolean; message: string; skipDiscard?: boolean }
      if (strategyDef.strategyType === 'deployable') {
        result = handleEquipStrategy({
          state, player, card, def: strategyDef, params,
        })
      } else {
        addLog(state, player.id, `使用了策略牌: ${strategyDef.name}`)
        result = executeInstantStrategy(strategyDef.instantType ?? '', {
          state, player, card, def: strategyDef, params,
        })
      }
      if (result.success) {
        if (!result.skipDiscard && strategyDef.strategyType !== 'deployable') {
          player.discardPile.push(card)
          this.checkStealDiscard(state, player, [card])
        }
      } else {
        player.hand.splice(Math.min(cardIndex, player.hand.length), 0, card)
      }
      return result
    }

    const cardDef = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
    if (!cardDef) {
      player.hand.splice(Math.min(cardIndex, player.hand.length), 0, card)
      return { success: false, message: '该卡牌不是行动牌' }
    }

    let result: { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean }

    addLog(state, player.id, `使用了行动牌: ${cardDef.name}`)

    switch (cardDef.actionType) {
      case 'attack':
        result = this.handleAttackCard(state, player, params)
        break

      case 'armorPierce':
        result = this.handleAttackCard(state, player, { ...params, armorPierce: true })
        break

      case 'bigBlock':
        result = this.handleBigBlock(state, player)
        break

      case 'smallBlock':
        result = this.handleSmallBlock(state, player, params)
        break

      case 'recovery':
        result = this.handleRecovery(state, player, params, false)
        break

      case 'bigRecovery':
        result = this.handleBigRecovery(state, player, params)
        break

      case 'replenish':
        result = this.handleReplenish(state, player, params)
        break

      default:
        result = { success: false, message: `Unknown action type: ${cardDef.actionType}` }
    }

    // Only remove card from hand if action succeeded
    if (result.success) {
      player.discardPile.push(card)
      this.checkStealDiscard(state, player, [card])
    } else {
      player.hand.splice(Math.min(cardIndex, player.hand.length), 0, card)
    }

    return result
  }

  // ----------------------------------------------------------
  // useSkill
  // ----------------------------------------------------------

  /**
   * Use a deployed character's skill.
   * Params: { attackerCharUid, targetPlayerId, targetCharUid } (for attack-type skills)
   */
  useSkill(
    state: GameState,
    playerId: string,
    charUid: string,
    params: Record<string, any>,
  ): { success: boolean; message: string } {
    const invalid = this.combatService.validateActor(state, playerId)
    if (invalid) return { success: false, message: invalid }
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    const slotInfo = this.findDeployedChar(player, charUid)
    if (!slotInfo) return { success: false, message: '场上未找到该角色' }

    const char = slotInfo.char
    if (char.state !== 'normal' || char.silenced || char.debuffs.some(d => d.type === 'loseAbility')) {
      return { success: false, message: '该角色无法使用技能' }
    }
    const charDef = getCharacterDef(char.cardId)
    if (!charDef || charDef.skills.length === 0) {
      return { success: false, message: '该角色没有技能' }
    }

    const skill = charDef.skills[0] // Use first skill

    if (skill.consumeActionPoint && !char.hasActionPoint) {
      return { success: false, message: '没有行动点了' }
    }

    // The legacy AP handler discards before looking for a recipient. Validate its
    // fallback target here so rejection cannot destroy a hand card.
    if (skill.effect.type === 'restoreAllyAP') {
      const requested = this.findDeployedChar(player, params.targetCharUid ?? '')?.char
      const hasRecipient = requested && !requested.hasActionPoint || player.deployed.some(s =>
        s.character?.state === 'normal' && !s.character.hasActionPoint)
      if (!hasRecipient) return { success: false, message: '所有角色已有行动点' }
    }
    const paysDiscard = ['restoreAllyAP', 'sacrificeForPower'].includes(skill.effect.type)
    const handBefore = paysDiscard ? [...player.hand] : []

    // Execute skill via dispatch table
    const result = executeSkill(
      state,
      playerId,
      charUid,
      skill.effect.type,
      params.targetCharUid,
      skill.effect.params,
    )

    if (result.success) {
      const discarded = handBefore.filter(c => !player.hand.some(remaining => remaining.uid === c.uid))
      player.discardPile.push(...discarded)
      if (discarded.length) this.checkStealDiscard(state, player, discarded)
      if (skill.consumeActionPoint) {
        char.hasActionPoint = false
        player.apUsedThisTurn++
      }
      addLog(state, player.id, `${charDef.name}使用了${skill.name}`, result.message)
    }

    return { success: result.success, message: result.message }
  }

  // ----------------------------------------------------------
  // replaceCharacter
  // ----------------------------------------------------------

  /**
   * Replace a deployed character with a character card from hand.
   * The old character goes to graveyard; the new one deploys at the same position.
   * V1.1: Max 1 replacement per turn when field is full.
   */
  replaceCharacter(
    state: GameState,
    playerId: string,
    deployedUid: string,
    handCardUid: string,
  ): { success: boolean; message: string } {
    const invalid = this.combatService.validateActor(state, playerId)
    if (invalid) return { success: false, message: invalid }
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    if (state.turnPhase !== 'action') {
      return { success: false, message: '只能在行动阶段替换角色' }
    }

    // V1.1: Check replacement limit when field is full (max 5 deployed)
    const deployedCount = player.deployed.filter(s => s.character && s.character.state !== 'retired').length
    if (deployedCount >= 5) {
      if (!player.replacementCountThisTurn) player.replacementCountThisTurn = 0
      if (player.replacementCountThisTurn >= 1) {
        return { success: false, message: '场地满时每回合最多替换1名角色' }
      }
    }

    // Find deployed character
    const deployedInfo = this.findDeployedChar(player, deployedUid)
    if (!deployedInfo) return { success: false, message: '场上未找到该角色' }

    // Find hand card
    const handIndex = player.hand.findIndex((c) => c.uid === handCardUid)
    if (handIndex === -1) return { success: false, message: '手牌中未找到该卡牌' }

    const handCard = player.hand[handIndex]
    const newCharDef = getCharacterDef(handCard.cardId)
    if (!newCharDef) return { success: false, message: '该卡牌不是角色牌' }

    const oldChar = deployedInfo.char
    const oldCharDef = getCharacterDef(oldChar.cardId)

    // Move old character to graveyard
    player.graveyard.push({
      uid: oldChar.uid,
      cardId: oldChar.cardId,
      suit: 'hearts' as any,
    })

    // Deploy new character at same position
    const newChar: DeployedCharacter = {
      uid: handCard.uid,
      cardId: handCard.cardId,
      currentHp: newCharDef.maxHp,
      maxHp: newCharDef.maxHp,
      attack: newCharDef.attack,
      state: 'normal',
      hasActionPoint: false, // replaced character doesn't get AP this turn
      armor: 0,
      buffs: [],
      debuffs: [],
      keywords: [...newCharDef.keywords],
      silenced: false,
    }

    player.deployed[deployedInfo.slotIndex].character = newChar

    // Remove from hand
    player.hand.splice(handIndex, 1)

    // Increment replacement count for this turn
    player.replacementCountThisTurn = (player.replacementCountThisTurn || 0) + 1

    addLog(state, playerId, `${oldCharDef?.name ?? oldChar.cardId}被替换为${newCharDef.name}`)
    return { success: true, message: `${oldCharDef?.name ?? oldChar.cardId}已替换为${newCharDef.name}` }
  }

  // ----------------------------------------------------------
  // endTurn
  // ----------------------------------------------------------

  /**
   * End the current player's turn.
   * Hand limit is 7 -- discard excess cards (simplified: discard random).
   * Advance to next player.
   */
  endTurn(state: GameState): GameState {
    const player = state.players[state.currentPlayerIndex]
    state.turnPhase = 'discard'

    // Hand limit: 5 non-character cards (character cards don't count)
    const LIMIT = 5
    const CHAR_LIMIT = 3
    const discardedThisTurn: CardInstance[] = []

    // Discard excess non-character cards
    const nonCharCards = player.hand.filter(c => getCharacterDef(c.cardId) === undefined)
    const excessNonChar = nonCharCards.length - LIMIT
    if (excessNonChar > 0) {
      // Shuffle and discard excess
      const shuffled = [...nonCharCards].sort(() => Math.random() - 0.5)
      const toDiscard = shuffled.slice(0, excessNonChar)
      for (const card of toDiscard) {
        const idx = player.hand.indexOf(card)
        if (idx !== -1) {
          player.hand.splice(idx, 1)
          player.discardPile.push(card)
          discardedThisTurn.push(card)
          addLog(state, player.id, `因手牌上限弃置了一张牌`)
        }
      }
    }

    // V1.1: Discard excess character cards (max 3)
    const charCards = player.hand.filter(c => getCharacterDef(c.cardId) !== undefined)
    const excessChar = charCards.length - CHAR_LIMIT
    if (excessChar > 0) {
      const shuffled = [...charCards].sort(() => Math.random() - 0.5)
      const toDiscard = shuffled.slice(0, excessChar)
      for (const card of toDiscard) {
        const idx = player.hand.indexOf(card)
        if (idx !== -1) {
          player.hand.splice(idx, 1)
          player.graveyard.push(card)
          discardedThisTurn.push(card)
          addLog(state, player.id, `因角色牌上限弃置了一张角色牌`)
        }
      }
    }

    if (discardedThisTurn.length > 0) {
      this.checkStealDiscard(state, player, discardedThisTurn)
    }

    addLog(state, player.id, `${player.name}的第${state.turnNumber}回合结束`)

    state.turnPhase = 'ended'

    // Advance to next player
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length

    // Increment turn number when wrapping around
    if (state.currentPlayerIndex === 0) {
      state.turnNumber++
    }

    // Check game over before starting next turn
    this.checkGameOver(state)

    return state
  }

  // ----------------------------------------------------------
  // checkGameOver
  // ----------------------------------------------------------

  /**
   * Check win conditions:
   * - A player wins if all other players have no deployed characters and
   *   no character cards in hand (eliminated).
   * - A player also wins if they are the last player alive.
   */
  checkGameOver(state: GameState): boolean {
    if (state.gameOver) return true

    for (const player of state.players) {
      if (!player.isAlive) continue

      const hasDeployedChars = player.deployed.some((s) => s.character !== null)
      const hasCharCards = player.hand.some((c) => getCharacterDef(c.cardId) !== undefined)

      if (!hasDeployedChars && !hasCharCards) {
        player.isAlive = false
        addLog(state, player.id, `${player.name}已被淘汰！`)
      }
    }

    const alivePlayers = state.players.filter((p) => p.isAlive)

    if (alivePlayers.length <= 1) {
      state.gameOver = true
      state.winner = alivePlayers[0]?.id ?? null
      if (state.winner) {
        addLog(state, state.winner, `游戏结束！${alivePlayers[0].name}获胜！`)
      }
      return true
    }

    return false
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private createPlayer(id: string, name: string, isAi: boolean): PlayerState {
    return {
      id,
      name,
      hp: 10,
      maxHp: 10,
      isAlive: true,
      isAi,
      hand: [],
      deployed: Array.from({ length: 5 }, (_, i) => ({
        position: i,
        character: null,
        equipment: null,
      })),
      graveyard: [],
      discardPile: [],
      judgmentZone: [],
      hpRecoveryUsed: 0,
      apUsedThisTurn: 0,
      replacementCountThisTurn: 0,
    }
  }

  private createCharacterPool(): CardInstance[] {
    const pool: CardInstance[] = []
    for (const def of CHARACTER_CARDS) {
      pool.push(this.deckService.createCardInstance(def.id))
    }
    return this.deckService.shuffle(pool)
  }

  private getCharName(char: DeployedCharacter): string {
    return getCharacterDef(char.cardId)?.name ?? char.cardId
  }

  // Note: getCharName and findDeployedChar are also exported from strategies/utils.ts
  // for use in strategy handlers

  /**
   * Check if any player has a character with stealDiscard buff.
   * If so, that player can steal one of the discarded cards.
   */
  private checkStealDiscard(state: GameState, discardingPlayer: PlayerState, discardedCards: CardInstance[]): void {
    for (const otherPlayer of state.players) {
      if (otherPlayer.id === discardingPlayer.id || !otherPlayer.isAlive) continue
      for (const slot of otherPlayer.deployed) {
        if (!slot.character || slot.character.state === 'retired') continue
        const buff = slot.character.buffs.find(b => b.type === 'stealDiscard' && b.remainingTurns !== 0 && b.value > 0)
        if (buff && discardedCards.length > 0) {
          // Steal a random card from the discard
          const stealIdx = Math.floor(Math.random() * discardedCards.length)
          const stolen = discardedCards.splice(stealIdx, 1)[0]
          otherPlayer.hand.push(stolen)
          // Also remove from discarding player's discard pile if present
          const discardIdx = discardingPlayer.discardPile.findIndex(c => c.uid === stolen.uid)
          if (discardIdx !== -1) discardingPlayer.discardPile.splice(discardIdx, 1)
          const graveyardIdx = discardingPlayer.graveyard.findIndex(c => c.uid === stolen.uid)
          if (graveyardIdx !== -1) discardingPlayer.graveyard.splice(graveyardIdx, 1)
          addLog(state, otherPlayer.id, `${this.getCharName(slot.character)}窃取了${discardingPlayer.name}的弃牌`)
          buff.remainingTurns = 0 // Consume the buff
          return // Only steal once per discard event
        }
      }
    }
  }

  private findDeployedChar(
    player: PlayerState,
    charUid: string,
  ): { slotIndex: number; char: DeployedCharacter } | undefined {
    for (let i = 0; i < player.deployed.length; i++) {
      const char = player.deployed[i].character
      if (char && char.uid === charUid) {
        return { slotIndex: i, char }
      }
    }
    return undefined
  }

  /**
   * Consume AP from any available character (for block cards which share AP pool).
   * Returns true if successful, false if no AP available or limit reached.
   */
  private consumeApFromAny(player: PlayerState): boolean {
    for (const slot of player.deployed) {
      if (slot.character && canUseAp(slot.character)) {
        slot.character.hasActionPoint = false
        player.apUsedThisTurn++
        return true
      }
    }
    return false
  }

  // ----- Card effect handlers -----

  private handleAttackCard(
    state: GameState,
    attackerPlayer: PlayerState,
    params: Record<string, any>,
  ): { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean } {
    const { attackerCharUid, targetPlayerId, targetCharUid, armorPierce, targetType } = params

    if (!attackerCharUid || !targetPlayerId) {
      return { success: false, message: '缺少必要参数: attackerCharUid, targetPlayerId' }
    }

    if (!targetCharUid || targetType === 'player') {
      return this.directAttack(state, attackerPlayer.id, attackerCharUid, targetPlayerId)
    }

    return this.combatService.resolveAttack(
      state,
      attackerPlayer.id,
      attackerCharUid,
      targetPlayerId,
      targetCharUid,
      armorPierce ?? false,
    )
  }

  attack(state: GameState, playerId: string, charUid: string, targetPlayerId: string,
    targetCharUid: string, armorPierce = false) {
    return this.combatService.resolveAttack(state, playerId, charUid, targetPlayerId, targetCharUid, armorPierce)
  }

  directAttack(state: GameState, playerId: string, charUid: string, targetPlayerId: string) {
    return this.combatService.resolveDirectAttack(state, playerId, charUid, targetPlayerId)
  }

  private handleBigBlock(
    state: GameState,
    player: PlayerState,
  ): { success: boolean; message: string } {
    // Block consumes AP from any available character (shared pool)
    const apUser = this.consumeApFromAny(player)
    if (!apUser) {
      return { success: false, message: '没有可用的行动点' }
    }

    let count = 0
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        slot.character.buffs.push({
          type: 'block',
          value: 1,
          remainingTurns: 2,
          source: 'bigBlock',
        })
        count++
      }
    }
    addLog(state, player.id, `大格挡已施加给${count}个角色`)
    return { success: true, message: `大格挡已施加给${count}个角色（各抵挡一次伤害）` }
  }

  private handleSmallBlock(
    state: GameState,
    player: PlayerState,
    params: Record<string, any>,
  ): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) {
      return { success: false, message: '缺少目标角色ID' }
    }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    // Block consumes AP from any available character (shared pool)
    const apUser = this.consumeApFromAny(player)
    if (!apUser) {
      return { success: false, message: '没有可用的行动点' }
    }

    info.char.buffs.push({
      type: 'block',
      value: 1,
      remainingTurns: 2,
      source: 'smallBlock',
    })

    addLog(state, player.id, `小格挡已施加给${this.getCharName(info.char)}`)
    return { success: true, message: `小格挡已施加给${this.getCharName(info.char)}（抵挡一次伤害）` }
  }

  private handleRecovery(
    state: GameState,
    player: PlayerState,
    params: Record<string, any>,
    _big: boolean,
  ): { success: boolean; message: string } {
    const { targetCharUid, targetType } = params

    // Player HP recovery mode (小回复: +2体力)
    if (targetType === 'player') {
      if (player.hp >= player.maxHp) {
        return { success: false, message: '玩家体力已满' }
      }
      const healAmount = Math.min(2, player.maxHp - player.hp)
      player.hp = Math.min(player.maxHp, player.hp + 2)
      addLog(state, player.id, `玩家恢复了${healAmount}点体力，当前${player.hp}/${player.maxHp}`)
      return { success: true, message: `玩家恢复了${healAmount}点体力` }
    }

    // Character recovery mode (default)
    if (!targetCharUid) {
      return { success: false, message: '缺少目标角色ID' }
    }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    const char = info.char
    if (char.state === 'retired') {
      return { success: false, message: '无法治疗已击退的角色' }
    }

    const charDef = getCharacterDef(char.cardId)
    const maxHp = charDef?.maxHp ?? char.maxHp

    // Near-death → restore to normal + full HP
    if (char.state === 'nearDeath') {
      char.state = 'normal'
      char.currentHp = maxHp
      // Restore AP only if character hasn't acted this turn
      if (!char.hasActionPoint) {
        char.hasActionPoint = true
      }
      addLog(state, player.id, `${this.getCharName(char)}通过回复卡从濒死中恢复，体力回满`)
      return { success: true, message: `${this.getCharName(char)}从濒死中恢复，体力${char.currentHp}/${maxHp}` }
    }

    // Normal → heal to maxHP
    char.currentHp = maxHp
    // Restore AP only if character hasn't acted this turn
    if (!char.hasActionPoint) {
      char.hasActionPoint = true
    }
    addLog(state, player.id, `${this.getCharName(char)}体力回满`)
    return { success: true, message: `${this.getCharName(char)}体力回满至${char.currentHp}/${maxHp}` }
  }

  private handleBigRecovery(
    state: GameState,
    player: PlayerState,
    params?: Record<string, any>,
  ): { success: boolean; message: string } {
    const targetType = params?.targetType

    // Player HP recovery mode (大回复: +5体力)
    if (targetType === 'player') {
      if (player.hp >= player.maxHp) {
        return { success: false, message: '玩家体力已满' }
      }
      const healAmount = Math.min(5, player.maxHp - player.hp)
      player.hp = Math.min(player.maxHp, player.hp + 5)
      addLog(state, player.id, `玩家恢复了${healAmount}点体力，当前${player.hp}/${player.maxHp}`)
      return { success: true, message: `玩家恢复了${healAmount}点体力` }
    }

    let healed = 0
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        const charDef = getCharacterDef(slot.character.cardId)
        const maxHp = charDef?.maxHp ?? slot.character.maxHp

        if (slot.character.state === 'nearDeath') {
          slot.character.state = 'normal'
        }
        slot.character.currentHp = maxHp

        // Restore AP only if character hasn't acted this turn
        if (!slot.character.hasActionPoint) {
          slot.character.hasActionPoint = true
        }
        healed++
      }
    }
    addLog(state, player.id, `大回复已治疗${healed}个角色，体力回满`)
    return { success: true, message: `大回复已治疗${healed}个角色，体力回满` }
  }

  private handleReplenish(
    state: GameState,
    player: PlayerState,
    params?: Record<string, any>,
  ): { success: boolean; message: string } {
    const mode = params?.mode ?? 'draw'

    if (mode === 'recruit') {
      // Recruit: add a random character from pool to hand (costs 3 HP)
      if (state.characterPool.length === 0) {
        return { success: false, message: '角色池为空' }
      }
      if (player.hp < 3) {
        return { success: false, message: '体力值不足（需要3点）' }
      }
      const idx = randomInt(0, state.characterPool.length - 1)
      const recruited = state.characterPool.splice(idx, 1)[0]
      player.hand.push(recruited)
      player.hp -= 3
      const charDef = getCharacterDef(recruited.cardId)
      addLog(state, player.id, `消耗3点体力从角色池招揽了${charDef?.name ?? recruited.cardId}`)
      return { success: true, message: `消耗3点体力招揽了${charDef?.name ?? recruited.cardId}` }
    }

    // Default: draw mode
    if (state.actionDeck.length === 0) {
      this.reshuffleDeck(state)
    }

    const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 2)
    player.hand.push(...drawn)
    state.actionDeck = remaining

    addLog(state, player.id, `补充摸了${drawn.length}张牌`)
    return { success: true, message: `摸了${drawn.length}张牌` }
  }

  /**
   * Reshuffle all players' discard piles back into the action deck.
   */
  private reshuffleDeck(state: GameState): void {
    const allDiscarded: CardInstance[] = []
    for (const player of state.players) {
      allDiscarded.push(...player.discardPile)
      player.discardPile = []
    }
    if (allDiscarded.length > 0) {
      state.actionDeck = this.deckService.shuffle(allDiscarded)
      addLog(state, 'system', `牌堆已耗尽，弃牌堆已洗回牌堆（${allDiscarded.length}张）`)
    }
  }

  /**
   * Resolve a judgment zone card effect during the judgment phase.
   * Returns 'moveToNext' if the card should be passed to the next player, null otherwise.
   */
  private resolveJudgment(
    state: GameState,
    player: PlayerState,
    card: CardInstance,
    def: StrategyCardDef,
  ): 'moveToNext' | null {
    const je = def.judgmentEffect!
    addLog(state, player.id, `判定: ${def.name}`)

    switch (je.type) {
      case 'suitCheck': {
        const suit = this.diceService.suitJudgment()
        const success = je.suitCondition
          ? this.diceService.checkSuitCondition(suit, je.suitCondition)
          : true

        addLog(state, player.id, `花色判定: ${suit} (条件: ${je.suitCondition ?? '无'}, ${success ? '成功' : '失败'})`)

        if (success && je.onSuccess) {
          this.applyJudgmentResult(state, player, je.onSuccess)
        } else if (!success && je.onFail) {
          this.applyJudgmentResult(state, player, je.onFail)
        }
        return null
      }
      case 'probabilityCheck': {
        const rate = '1/2'
        const success = this.diceService.probabilityCheck(rate)
        addLog(state, player.id, `概率判定: ${rate} (${success ? '成功' : '失败'})`)

        if (success && je.onSuccess) {
          this.applyJudgmentResult(state, player, je.onSuccess)
        } else if (!success && je.onFail) {
          this.applyJudgmentResult(state, player, je.onFail)
        }
        // B0002: probabilityCheck with placeJudgmentPass - if success (no onSuccess), pass to next
        if (success && !je.onSuccess) {
          return 'moveToNext'
        }
        // If fail and no onFail, also pass to next (defensive)
        if (!success && !je.onFail) {
          return 'moveToNext'
        }
        return null
      }
      case 'moveToNext': {
        const nextIdx = (state.currentPlayerIndex + 1) % state.players.length
        const nextPlayer = state.players[nextIdx]
        addLog(state, player.id, `判定传递: 移至${nextPlayer.name}`)
        return 'moveToNext'
      }
    }
  }

  /**
   * Apply a judgment result string (e.g., "skipAction", "skipDraw", "damage:2")
   */
  private applyJudgmentResult(
    state: GameState,
    player: PlayerState,
    result: string,
  ): void {
    const parts = result.split(':')
    const type = parts[0]
    const value = parts[1] ? parseInt(parts[1], 10) : 1

    switch (type) {
      case 'skipAction':
        // Apply skipAction to all deployed characters
        for (const slot of player.deployed) {
          if (slot.character && slot.character.state === 'normal') {
            slot.character.debuffs.push({
              type: 'skipAction',
              value: 1,
              remainingTurns: 1,
              source: 'judgment',
            })
          }
        }
        addLog(state, player.id, '判定结果: 跳过行动阶段')
        break

      case 'skipDraw':
        for (const slot of player.deployed) {
          if (slot.character && slot.character.state === 'normal') {
            slot.character.debuffs.push({
              type: 'skipDraw',
              value: 1,
              remainingTurns: 1,
              source: 'judgment',
            })
          }
        }
        addLog(state, player.id, '判定结果: 跳过摸牌阶段')
        break

      case 'damage':
        player.hp = Math.max(0, player.hp - value)
        addLog(state, player.id, `判定结果: 受到${value}点伤害`)
        break

      case 'loseAbility':
        for (const slot of player.deployed) {
          if (slot.character && slot.character.state === 'normal') {
            slot.character.debuffs.push({
              type: 'loseAbility',
              value: 1,
              remainingTurns: 1,
              source: 'judgment',
            })
          }
        }
        addLog(state, player.id, '判定结果: 失去行动能力')
        break

      case 'discard':
        // Discard a random card
        if (player.hand.length > 0) {
          const idx = randomInt(0, player.hand.length - 1)
          const discarded = player.hand.splice(idx, 1)[0]
          player.discardPile.push(discarded)
          addLog(state, player.id, '判定结果: 弃置一张手牌')
        }
        break

      case 'draw':
        if (state.actionDeck.length > 0) {
          const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, value)
          player.hand.push(...drawn)
          state.actionDeck = remaining
          addLog(state, player.id, `判定结果: 摸${value}张牌`)
        }
        break

      default:
        addLog(state, player.id, `判定结果: ${result}`)
        break
    }
  }

  // ----------------------------------------------------------
  // Strategy card handlers
  // ----------------------------------------------------------

  /**
   * Use an equipment's conditionalBonus effect.
   * Activated during action phase, consumes action point.
   */
  useEquipment(
    state: GameState,
    playerId: string,
    charUid: string,
    params: Record<string, any>,
  ): { success: boolean; message: string } {
    const invalid = this.combatService.validateActor(state, playerId)
    if (invalid) return { success: false, message: invalid }
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    if (state.turnPhase !== 'action') {
      return { success: false, message: '只能在行动阶段使用装备效果' }
    }

    const slotInfo = this.findDeployedChar(player, charUid)
    if (!slotInfo) return { success: false, message: '场上未找到该角色' }

    const slot = player.deployed[slotInfo.slotIndex]
    if (!slot.equipment) return { success: false, message: '该角色没有装备' }

    const char = slotInfo.char
    if (char.state !== 'normal' || char.debuffs.some(d => d.type === 'loseAbility')) {
      return { success: false, message: '该角色无法行动' }
    }
    if (!char.hasActionPoint) return { success: false, message: '该角色没有行动点' }

    // Find conditionalBonus buff
    const bonusBuff = char.buffs.find(b => b.type === 'conditionalBonus')
    if (!bonusBuff) return { success: false, message: '该装备没有可激活的效果' }

    // Extract condition from source (format: "cardUid:condition")
    const condition = bonusBuff.source.split(':')[1]
    if (!condition) return { success: false, message: '未知装备效果' }
    if (['scry5pick2', 'guessSuit'].includes(condition) && state.actionDeck.length === 0) {
      return { success: false, message: '牌堆为空' }
    }

    // Consume action point
    char.hasActionPoint = false
    player.apUsedThisTurn++

    const equipDef = this.deckService.getStrategyCardDef(slot.equipment.cardId)
    const equipName = equipDef?.name ?? '装备'

    switch (condition) {
      case 'scry5pick2': {
        // Draw 5 cards from deck, let player pick 2 (simplified: AI picks first 2, player gets them)
        const drawCount = Math.min(5, state.actionDeck.length)
        if (drawCount === 0) return { success: false, message: '牌堆为空' }
        const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, drawCount)
        state.actionDeck = remaining
        // For simplicity, take first 2 (or all if less than 2)
        const picked = drawn.splice(0, Math.min(2, drawn.length))
        player.hand.push(...picked)
        // Put rest back and shuffle
        state.actionDeck.push(...drawn)
        state.actionDeck = this.deckService.shuffle(state.actionDeck)
        addLog(state, player.id, `${equipName}: 翻5选2，获得${picked.length}张牌`)
        return { success: true, message: `翻5选2，获得${picked.length}张牌` }
      }

      case 'discardToDraw': {
        // Discard the equipment card to draw 1 card
        const equip = slot.equipment
        slot.equipment = null
        player.discardPile.push(equip)
        // Remove the conditionalBonus buff
        char.buffs = char.buffs.filter(b => b.type !== 'conditionalBonus')
        if (state.actionDeck.length > 0) {
          const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 1)
          player.hand.push(...drawn)
          state.actionDeck = remaining
          addLog(state, player.id, `${equipName}: 弃置装备，摸1张牌`)
          return { success: true, message: '弃置装备，摸1张牌' }
        }
        addLog(state, player.id, `${equipName}: 弃置装备，但牌堆为空`)
        return { success: true, message: '弃置装备，但牌堆为空' }
      }

      case 'forceDiceSuccess': {
        // Next probability check is forced to succeed (stored as buff)
        char.buffs.push({ type: 'forceDiceSuccess', value: 1, remainingTurns: 1, source: slot.equipment.uid })
        addLog(state, player.id, `${equipName}: 下次概率判定强制成功`)
        return { success: true, message: '下次概率判定强制成功' }
      }

      case 'guessSuit': {
        // Guess the top card's suit (simplified: auto-guess hearts)
        if (state.actionDeck.length === 0) return { success: false, message: '牌堆为空' }
        const topCard = state.actionDeck[0]
        const guessedSuit = params.suit ?? 'hearts' // Player can specify suit
        if (topCard.suit === guessedSuit) {
          addLog(state, player.id, `${equipName}: 猜对花色！`)
          return { success: true, message: '猜对花色！' }
        } else {
          char.state = 'nearDeath'
          addLog(state, player.id, `${equipName}: 猜错花色，进入濒死`)
          return { success: true, message: '猜错花色，进入濒死' }
        }
      }

      case 'nuke': {
        // Discard all hand cards; at end of next turn, all characters retire
        const handSize = player.hand.length
        player.discardPile.push(...player.hand)
        player.hand = []
        // Store a pending effect for next turn
        state.pendingEffects.push({
          id: `nuke_${Date.now()}`,
          type: 'nuke',
          source: charUid,
          target: '*',
          params: {},
          resolved: false,
          sourcePlayerId: playerId,
          targetPlayerId: '*',
          remainingTurns: 2,
        })
        addLog(state, player.id, `${equipName}: 弃置全部手牌(${handSize}张)，下回合结束所有角色退场`)
        return { success: true, message: `弃置${handSize}张手牌，下回合全场退场` }
      }

      default:
        // Other conditions not yet implemented
        addLog(state, player.id, `${equipName}: 条件加成(${condition})暂未实现`)
        return { success: true, message: `条件加成(${condition})暂未实现` }
    }
  }


}
