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

    // Near-death recovery check for this player's characters
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'nearDeath') {
        // Roll d6: need 5-6 to recover (1/3 chance)
        const roll = randomInt(1, 6)
        if (roll >= 5) {
          slot.character.state = 'normal'
          addLog(
            state,
            player.id,
            `${this.getCharName(slot.character)}从濒死中恢复了！`,
            `掷骰=${roll}`,
          )
        } else {
          addLog(
            state,
            player.id,
            `${this.getCharName(slot.character)}仍处于濒死状态`,
            `掷骰=${roll}`,
          )
        }
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
          .map((b) => ({ ...b, remainingTurns: b.remainingTurns - 1 }))
          .filter((b) => b.remainingTurns !== 0)
        slot.character.debuffs = slot.character.debuffs
          .map((d) => ({ ...d, remainingTurns: d.remainingTurns - 1 }))
          .filter((d) => d.remainingTurns !== 0)
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

    const card = player.hand[cardIndex]

    // Strategy card branch
    const strategyDef = this.deckService.getStrategyCardDef(card.cardId)
    if (strategyDef) {
      let result: { success: boolean; message: string; skipDiscard?: boolean }
      if (strategyDef.strategyType === 'deployable') {
        result = this.handleEquipStrategy(state, player, card, strategyDef, params)
      } else {
        result = this.handleInstantStrategy(state, player, card, strategyDef, params)
      }
      if (result.success) {
        player.hand.splice(cardIndex, 1)
        if (!result.skipDiscard) {
          player.discardPile.push(card)
          this.checkStealDiscard(state, player, [card])
        }
      }
      return result
    }

    const cardDef = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
    if (!cardDef) {
      return { success: false, message: '该卡牌不是行动牌' }
    }

    let result: { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean }

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
      player.hand.splice(cardIndex, 1)
      player.discardPile.push(card)
      this.checkStealDiscard(state, player, [card])
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
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    const slotInfo = this.findDeployedChar(player, charUid)
    if (!slotInfo) return { success: false, message: '场上未找到该角色' }

    const char = slotInfo.char
    const charDef = getCharacterDef(char.cardId)
    if (!charDef || charDef.skills.length === 0) {
      return { success: false, message: '该角色没有技能' }
    }

    const skill = charDef.skills[0] // Use first skill

    if (skill.consumeActionPoint && !char.hasActionPoint) {
      return { success: false, message: '没有行动点了' }
    }

    // AP limit: max 3 characters per turn
    if (skill.consumeActionPoint && player.apUsedThisTurn >= 3) {
      return { success: false, message: '本回合已使用3名角色的行动点' }
    }

    // Consume action point if needed
    if (skill.consumeActionPoint) {
      char.hasActionPoint = false
      player.apUsedThisTurn++
    }

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
   */
  replaceCharacter(
    state: GameState,
    playerId: string,
    deployedUid: string,
    handCardUid: string,
  ): { success: boolean; message: string } {
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return { success: false, message: '未找到玩家' }

    if (state.turnPhase !== 'action') {
      return { success: false, message: '只能在行动阶段替换角色' }
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
    const discardedThisTurn: CardInstance[] = []
    while (true) {
      const nonCharCards = player.hand.filter(c => getCharacterDef(c.cardId) === undefined)
      if (nonCharCards.length <= LIMIT) break
      // Discard a random non-character card
      const idx = player.hand.findIndex(c => getCharacterDef(c.cardId) === undefined && c === nonCharCards[randomInt(0, nonCharCards.length - 1)])
      if (idx === -1) break
      const discarded = player.hand.splice(idx, 1)[0]
      player.discardPile.push(discarded)
      discardedThisTurn.push(discarded)
      addLog(state, player.id, `因手牌上限弃置了一张牌`)
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

  /**
   * Check if any player has a character with stealDiscard buff.
   * If so, that player can steal one of the discarded cards.
   */
  private checkStealDiscard(state: GameState, discardingPlayer: PlayerState, discardedCards: CardInstance[]): void {
    for (const otherPlayer of state.players) {
      if (otherPlayer.id === discardingPlayer.id || !otherPlayer.isAlive) continue
      for (const slot of otherPlayer.deployed) {
        if (!slot.character || slot.character.state === 'retired') continue
        const buff = slot.character.buffs.find(b => b.type === 'stealDiscard')
        if (buff && discardedCards.length > 0) {
          // Steal a random card from the discard
          const stealIdx = Math.floor(Math.random() * discardedCards.length)
          const stolen = discardedCards.splice(stealIdx, 1)[0]
          otherPlayer.hand.push(stolen)
          // Also remove from discarding player's discard pile if present
          const discardIdx = discardingPlayer.discardPile.findIndex(c => c.uid === stolen.uid)
          if (discardIdx !== -1) discardingPlayer.discardPile.splice(discardIdx, 1)
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
    if (player.apUsedThisTurn >= 3) return false
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal' && slot.character.hasActionPoint) {
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
    const { attackerCharUid, targetPlayerId, targetCharUid, armorPierce } = params

    if (!attackerCharUid || !targetPlayerId || !targetCharUid) {
      return { success: false, message: '缺少必要参数: attackerCharUid, targetPlayerId, targetCharUid' }
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
          value: 2,
          remainingTurns: 2,
          source: 'bigBlock',
        })
        count++
      }
    }
    addLog(state, player.id, `大格挡已施加给${count}个角色`)
    return { success: true, message: `大格挡已施加给${count}个角色（各+2护甲）` }
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
      value: 2,
      remainingTurns: 2,
      source: 'smallBlock',
    })

    addLog(state, player.id, `小格挡已施加给${this.getCharName(info.char)}`)
    return { success: true, message: `小格挡已施加给${this.getCharName(info.char)}（+2护甲）` }
  }

  private handleRecovery(
    state: GameState,
    player: PlayerState,
    params: Record<string, any>,
    _big: boolean,
  ): { success: boolean; message: string } {
    const { targetCharUid, targetType } = params

    // Player HP recovery mode
    if (targetType === 'player') {
      if (player.hp >= player.maxHp) {
        return { success: false, message: '玩家体力已满' }
      }
      player.hp = player.maxHp
      addLog(state, player.id, `玩家体力回满至${player.hp}/${player.maxHp}`)
      return { success: true, message: `玩家体力回满至${player.hp}/${player.maxHp}` }
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

    // Player HP recovery mode
    if (targetType === 'player') {
      if (player.hp >= player.maxHp) {
        return { success: false, message: '玩家体力已满' }
      }
      player.hp = player.maxHp
      addLog(state, player.id, `玩家体力回满至${player.hp}/${player.maxHp}`)
      return { success: true, message: `玩家体力回满至${player.hp}/${player.maxHp}` }
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
      // Recruit: add a random character from pool to hand
      if (state.characterPool.length === 0) {
        return { success: false, message: '角色池为空' }
      }
      const idx = randomInt(0, state.characterPool.length - 1)
      const recruited = state.characterPool.splice(idx, 1)[0]
      player.hand.push(recruited)
      const charDef = getCharacterDef(recruited.cardId)
      addLog(state, player.id, `从角色池招揽了${charDef?.name ?? recruited.cardId}`)
      return { success: true, message: `招揽了${charDef?.name ?? recruited.cardId}` }
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
    if (!char.hasActionPoint) return { success: false, message: '该角色没有行动点' }

    // Find conditionalBonus buff
    const bonusBuff = char.buffs.find(b => b.type === 'conditionalBonus')
    if (!bonusBuff) return { success: false, message: '该装备没有可激活的效果' }

    // Extract condition from source (format: "cardUid:condition")
    const condition = bonusBuff.source.split(':')[1]
    if (!condition) return { success: false, message: '未知装备效果' }

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

  /**
   * Equip a deployable strategy card to a deployed character.
   */
  private handleEquipStrategy(
    state: GameState,
    player: PlayerState,
    card: CardInstance,
    def: StrategyCardDef,
    params: Record<string, any>,
  ): { success: boolean; message: string } {
    const { targetCharUid } = params

    if (def.requiresTarget && !targetCharUid) {
      return { success: false, message: '需要指定装备目标角色' }
    }

    // Find the target character slot
    const slotInfo = this.findDeployedChar(player, targetCharUid)
    if (!slotInfo) return { success: false, message: '未找到目标角色' }

    const slot = player.deployed[slotInfo.slotIndex]
    if (slot.equipment) {
      return { success: false, message: '该角色已有装备' }
    }

    // Equip the card
    slot.equipment = card

    // Apply immediate equip effects
    const char = slotInfo.char
    const effects = def.equipEffects ?? []
    const appliedEffects: string[] = []

    for (const effect of effects) {
      switch (effect.type) {
        case 'attackBoost':
          char.attack += effect.value ?? 0
          appliedEffects.push(`攻击+${effect.value}`)
          break
        case 'hpBoost':
          char.maxHp += effect.value ?? 0
          char.currentHp += effect.value ?? 0
          appliedEffects.push(`体力+${effect.value}`)
          break
        case 'armorBoost':
          char.armor += effect.value ?? 0
          appliedEffects.push(`护甲+${effect.value}`)
          break
        case 'handLimitBoost':
          // Hand limit boost is tracked on player, not character
          appliedEffects.push(`手牌上限+${effect.value}`)
          break
        case 'grantKeyword':
          if (effect.keyword && !char.keywords.includes(effect.keyword)) {
            char.keywords.push(effect.keyword)
            appliedEffects.push(`获得关键词: ${effect.keyword}`)
          }
          break
        case 'silenceImmunity':
          if (!char.keywords.includes('silenceImmunity')) {
            char.keywords.push('silenceImmunity')
          }
          appliedEffects.push('沉默免疫')
          break
        case 'armorPierceOnAttack':
          char.buffs.push({ type: 'armorPierceOnAttack', value: 1, remainingTurns: -1, source: card.uid })
          appliedEffects.push('攻击时穿甲')
          break
        case 'nearDeathRecover':
          char.buffs.push({ type: 'nearDeathRecover', value: 1, remainingTurns: -1, source: card.uid })
          appliedEffects.push('濒死恢复')
          break
        case 'unTargetable':
          if (!char.keywords.includes('untargetable')) {
            char.keywords.push('untargetable')
          }
          appliedEffects.push('不可选中')
          break
        case 'critOnAttack':
          char.buffs.push({ type: 'critOnAttack', value: 1, remainingTurns: -1, source: card.uid })
          appliedEffects.push('攻击暴击')
          break
        case 'ignoreGuardian':
          if (!char.keywords.includes('ignoreGuardian')) {
            char.keywords.push('ignoreGuardian')
          }
          appliedEffects.push('无视守护')
          break
        case 'counterSilence':
          if (!char.keywords.includes('counterSilence')) {
            char.keywords.push('counterSilence')
          }
          appliedEffects.push('反击沉默')
          break
        case 'forceRetireOnHit':
          char.buffs.push({ type: 'forceRetireOnHit', value: 1, remainingTurns: -1, source: card.uid })
          appliedEffects.push('命中时强制退场')
          break
        case 'conditionalBonus':
          // Store the condition as a buff for later activation
          char.buffs.push({
            type: 'conditionalBonus',
            value: 0,
            remainingTurns: -1,
            source: `${card.uid}:${effect.condition}`,
          })
          appliedEffects.push(`条件加成: ${effect.condition}`)
          break
        default:
          appliedEffects.push(effect.type)
          break
      }
    }

    const charName = this.getCharName(char)
    addLog(state, player.id, `${charName}装备了${def.name}`, appliedEffects.join(', '))
    return { success: true, message: `${charName}装备了${def.name}（${appliedEffects.join(', ')}）` }
  }

  /**
   * Handle an instant strategy card.
   */
  private handleInstantStrategy(
    state: GameState,
    player: PlayerState,
    card: CardInstance,
    def: StrategyCardDef,
    params: Record<string, any>,
  ): { success: boolean; message: string; skipDiscard?: boolean } {
    const t = def.instantType ?? ''
    switch (t) {
      case 'disarmEquipment':       return this.instantDisarmEquipment(state, player, params)
      case 'discardUndeployedChar': return this.instantDiscardUndeployedChar(state, player, params)
      case 'duelMode':              return this.instantDuelMode(state, player, params)
      case 'counterInstant':        return this.instantCounterInstant(state, player, params)
      case 'stealEquipment':        return this.instantStealEquipment(state, player, params)
      case 'placeJudgment':         return this.instantPlaceJudgment(state, player, card, def, params)
      case 'grantTempArmorPierce':  return this.instantGrantTempArmorPierce(state, player, params)
      case 'russianRoulette':       return this.instantRussianRoulette(state, player, params)
      case 'suitJudgmentDraw':      return this.instantSuitJudgmentDraw(state, player, card, def)
      case 'placeJudgmentPass':     return this.instantPlaceJudgmentPass(state, player, card, def, params)
      case 'retrieveInstantFromDiscard': return this.instantRetrieveInstantFromDiscard(state, player)
      case 'drawCharAndDeploy':     return this.instantDrawCharAndDeploy(state, player)
      case 'removeJudgment':        return this.instantRemoveJudgment(state, player, params)
      case 'summonFromGraveyard':   return this.instantSummonFromGraveyard(state, player, params)
      case 'grantCrit':             return this.instantGrantCrit(state, player, params)
      case 'unlimitedApThisTurn':   return this.instantUnlimitedApThisTurn(state, player)
      case 'swapHandWithPlayers':   return this.instantSwapHandWithPlayers(state, player)
      case 'swapPositions':         return this.instantSwapPositions(state, player, params)
      case 'silenceTarget':         return this.instantSilenceTarget(state, player, params)
      case 'viewHand':              return this.instantViewHand(state, player, params)
      case 'slotMachine':           return this.instantSlotMachine(state, player)
      case 'allPlayersDraw':        return this.instantAllPlayersDraw(state, player)
      case 'protectNearDeath':      return this.instantProtectNearDeath(state, player, params)
      case 'chanceIgnoreSkill':     return this.instantChanceIgnoreSkill(state, player)
      case 'weakenTwoTargets':      return this.instantWeakenTwoTargets(state, player, params)
      case 'feverEffect':           return this.instantFeverEffect(state, player)
      case 'retrieveFromDiscard':   return this.instantRetrieveFromDiscard(state, player, params)
      case 'forceEarthStore':       return this.instantForceEarthStore(state, player, params)
      case 'drawAndRemoveEvil':     return this.instantDrawAndRemoveEvil(state, player)
      case 'removeDebuff':          return this.instantRemoveDebuff(state, player, params)
      case 'disableFactionSkill':   return this.instantDisableFactionSkill(state, player, params)
      case 'counterSkill':          return this.instantCounterSkill(state, player, params)
      case 'maintainFactionSkill':  return this.instantMaintainFactionSkill(state, player)
      default:
        return { success: false, message: `未实现的即时效果: ${t}` }
    }
  }

  // ----- Instant card individual handlers -----

  /** A0003 禁止事项: Disarm target enemy character (remove equipment) */
  private instantDisarmEquipment(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId, targetCharUid } = params
    if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标角色' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const info = this.findDeployedChar(targetPlayer, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    const slot = targetPlayer.deployed[info.slotIndex]
    if (!slot.equipment) return { success: false, message: '该角色没有装备' }

    const equipCard = slot.equipment
    slot.equipment = null
    targetPlayer.discardPile.push(equipCard)

    const charName = this.getCharName(info.char)
    addLog(state, player.id, `${charName}的装备被拆除`)
    return { success: true, message: `${charName}的装备已被拆除` }
  }

  /** A0004 财团B的阴谋: Discard an undeployed character from enemy hand */
  private instantDiscardUndeployedChar(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId, targetCardUid } = params
    if (!targetPlayerId || !targetCardUid) return { success: false, message: '需要指定目标玩家和手牌' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const idx = targetPlayer.hand.findIndex(c => c.uid === targetCardUid)
    if (idx === -1) return { success: false, message: '未找到该手牌' }

    const card = targetPlayer.hand.splice(idx, 1)[0]
    targetPlayer.discardPile.push(card)

    const charDef = getCharacterDef(card.cardId)
    addLog(state, player.id, `${targetPlayer.name}的一张手牌被弃置`, charDef?.name ?? card.cardId)
    return { success: true, message: `已弃置${targetPlayer.name}的手牌` }
  }

  /** A0005 无限制live格斗: Duel mode - simplified: both discard attack cards, loser takes damage */
  private instantDuelMode(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    // Both players count attack cards in hand
    const isAttackCard = (c: CardInstance) => {
      const def = this.deckService.actionCardDefs.find(d => d.id === c.cardId)
      return def && (def.actionType === 'attack' || def.actionType === 'armorPierce')
    }

    const playerAttackCards = player.hand.filter(isAttackCard)
    const targetAttackCards = targetPlayer.hand.filter(isAttackCard)

    // Each discards up to 2 attack cards
    const playerDiscardCount = Math.min(2, playerAttackCards.length)
    const targetDiscardCount = Math.min(2, targetAttackCards.length)

    for (let i = 0; i < playerDiscardCount; i++) {
      const idx = player.hand.indexOf(playerAttackCards[i])
      if (idx !== -1) player.discardPile.push(player.hand.splice(idx, 1)[0])
    }
    for (let i = 0; i < targetDiscardCount; i++) {
      const idx = targetPlayer.hand.indexOf(targetAttackCards[i])
      if (idx !== -1) targetPlayer.discardPile.push(targetPlayer.hand.splice(idx, 1)[0])
    }

    const diff = playerDiscardCount - targetDiscardCount
    if (diff > 0) {
      targetPlayer.hp -= 2
      addLog(state, player.id, `格斗对决: ${player.name}弃${playerDiscardCount}张, ${targetPlayer.name}弃${targetDiscardCount}张, ${targetPlayer.name}受2点伤害`)
      return { success: true, message: `格斗对决胜利！${targetPlayer.name}受2点伤害` }
    } else if (diff < 0) {
      player.hp -= 2
      addLog(state, player.id, `格斗对决: ${player.name}弃${playerDiscardCount}张, ${targetPlayer.name}弃${targetDiscardCount}张, ${player.name}受2点伤害`)
      return { success: true, message: `格斗对决失败！${player.name}受2点伤害` }
    } else {
      addLog(state, player.id, `格斗对决: 平局（各弃${playerDiscardCount}张）`)
      return { success: true, message: '格斗对决平局' }
    }
  }

  /** A0008 我有异议: Counter an instant card - mark pending counter for next opponent instant */
  private instantCounterInstant(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    // Mark all deployed characters with a counterInstant buff (lasts until next opponent instant)
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        slot.character.buffs.push({
          type: 'counterInstant',
          value: 1,
          remainingTurns: 1,
          source: 'A0008',
        })
      }
    }
    addLog(state, player.id, '使用了我有异议（下次对手即时牌失效）')
    return { success: true, message: '已使用我有异议：下次对手即时牌失效' }
  }

  /** A0012 拿来吧你: Steal equipment from enemy */
  private instantStealEquipment(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId, targetCharUid, targetAllyCharUid } = params
    if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const targetInfo = this.findDeployedChar(targetPlayer, targetCharUid)
    if (!targetInfo) return { success: false, message: '未找到目标角色' }

    const targetSlot = targetPlayer.deployed[targetInfo.slotIndex]
    if (!targetSlot.equipment) return { success: false, message: '目标角色没有装备' }

    // Find ally to equip to
    const allyInfo = targetAllyCharUid ? this.findDeployedChar(player, targetAllyCharUid) : null
    if (allyInfo) {
      const allySlot = player.deployed[allyInfo.slotIndex]
      if (allySlot.equipment) return { success: false, message: '友方角色已有装备' }
      allySlot.equipment = targetSlot.equipment
      targetSlot.equipment = null
      addLog(state, player.id, `偷取了${this.getCharName(targetInfo.char)}的装备给${this.getCharName(allyInfo.char)}`)
      return { success: true, message: '装备已偷取' }
    } else {
      // No ally specified, just discard the equipment
      const equip = targetSlot.equipment!
      targetSlot.equipment = null
      player.discardPile.push(equip)
      addLog(state, player.id, `拆除了${this.getCharName(targetInfo.char)}的装备`)
      return { success: true, message: '装备已拆除' }
    }
  }

  /** A0013 乐 / C0010 金玉 / D0014 噜不动了: Place a judgment card on target enemy */
  private instantPlaceJudgment(state: GameState, player: PlayerState, card: CardInstance, def: StrategyCardDef, params: Record<string, any>): { success: boolean; message: string; skipDiscard?: boolean } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    // Place this card into target's judgment zone
    targetPlayer.judgmentZone.push(card)
    addLog(state, player.id, `对${targetPlayer.name}放置了判定牌: ${def.name}`)
    return { success: true, message: `已对${targetPlayer.name}放置判定牌: ${def.name}`, skipDiscard: true }
  }

  /** A0014 巧克力螺: Grant temporary armor pierce to an ally */
  private instantGrantTempArmorPierce(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    info.char.buffs.push({
      type: 'tempArmorPierce',
      value: 1,
      remainingTurns: 1,
      source: 'chocolateScrew',
    })

    addLog(state, player.id, `${this.getCharName(info.char)}获得临时穿甲`)
    return { success: true, message: `${this.getCharName(info.char)}获得临时穿甲` }
  }

  /** A0015 俄罗斯轮盘: Russian roulette - both players roll, higher wins */
  private instantRussianRoulette(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const roll1 = this.diceService.rollDice(6)
    const roll2 = this.diceService.rollDice(6)

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

  /** A0016 小星星无限loop: Suit judgment, draw based on result */
  private instantSuitJudgmentDraw(state: GameState, player: PlayerState, card: CardInstance, def: StrategyCardDef): { success: boolean; message: string } {
    const suit = this.diceService.suitJudgment()
    const isHappy = this.diceService.isHappy(suit)
    const isPowerful = this.diceService.isPowerful(suit)

    let drawCount = 1
    if (isHappy) drawCount = 3
    else if (isPowerful) drawCount = 0

    if (drawCount > 0 && state.actionDeck.length > 0) {
      const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, drawCount)
      player.hand.push(...drawn)
      state.actionDeck = remaining
    }

    addLog(state, player.id, `小星星无限loop: 花色=${suit}, 摸${drawCount}张`)
    return { success: true, message: `花色判定: ${suit}, 摸${drawCount}张牌` }
  }

  /** B0002 五字不行: Place judgment + pass action */
  private instantPlaceJudgmentPass(state: GameState, player: PlayerState, card: CardInstance, def: StrategyCardDef, params: Record<string, any>): { success: boolean; message: string; skipDiscard?: boolean } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    targetPlayer.judgmentZone.push(card)
    addLog(state, player.id, `对${targetPlayer.name}放置了判定牌: ${def.name}`)
    return { success: true, message: `已对${targetPlayer.name}放置判定牌`, skipDiscard: true }
  }

  /** B0003 轨迹展: Retrieve an instant card from discard pile */
  private instantRetrieveInstantFromDiscard(state: GameState, player: PlayerState): { success: boolean; message: string } {
    const instantCards = player.discardPile.filter(c => {
      const def = this.deckService.getStrategyCardDef(c.cardId)
      return def && def.strategyType === 'instant'
    })

    if (instantCards.length === 0) {
      return { success: false, message: '弃牌堆中没有即时牌' }
    }

    // Take the first instant card from discard
    const card = instantCards[0]
    const idx = player.discardPile.findIndex(c => c.uid === card.uid)
    player.discardPile.splice(idx, 1)
    player.hand.push(card)

    const def = this.deckService.getStrategyCardDef(card.cardId)
    addLog(state, player.id, `从弃牌堆取回了${def?.name ?? card.cardId}`)
    return { success: true, message: `取回了${def?.name ?? card.cardId}` }
  }

  /** B0004 星光魔方: Draw a character card and deploy it if same faction exists */
  private instantDrawCharAndDeploy(state: GameState, player: PlayerState): { success: boolean; message: string } {
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

  /** B0005 拆弹专家: Remove a judgment card from own judgment zone */
  private instantRemoveJudgment(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId } = params
    const targetPlayer = targetPlayerId
      ? state.players.find(p => p.id === targetPlayerId) ?? player
      : player

    if (targetPlayer.judgmentZone.length === 0) {
      return { success: false, message: '判定区为空' }
    }

    const removed = targetPlayer.judgmentZone.splice(0, 1)[0]
    const def = this.deckService.getStrategyCardDef(removed.cardId)
    addLog(state, player.id, `拆弹专家: 移除了${def?.name ?? removed.cardId}的判定`)
    return { success: true, message: `移除了判定牌: ${def?.name ?? removed.cardId}` }
  }

  /** B0006 复活赛: Summon a character from graveyard */
  private instantSummonFromGraveyard(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCardUid } = params

    let card: CardInstance | undefined
    if (targetCardUid) {
      card = player.graveyard.find(c => c.uid === targetCardUid)
    } else {
      card = player.graveyard[0]
    }

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

  /** B0010 阿提斯特: Grant crit to an ally */
  private instantGrantCrit(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    info.char.buffs.push({
      type: 'crit',
      value: 2,
      remainingTurns: 2,
      source: 'artist',
    })

    addLog(state, player.id, `${this.getCharName(info.char)}获得暴击buff`)
    return { success: true, message: `${this.getCharName(info.char)}获得暴击` }
  }

  /** B0011 诡异的蘑菇: Unlimited AP this turn */
  private instantUnlimitedApThisTurn(state: GameState, player: PlayerState): { success: boolean; message: string } {
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

  /** B0012 何意味: Swap a random hand card with each other player */
  private instantSwapHandWithPlayers(state: GameState, player: PlayerState): { success: boolean; message: string } {
    const otherPlayers = state.players.filter(p => p.id !== player.id && p.isAlive)
    let swapCount = 0

    for (const other of otherPlayers) {
      if (player.hand.length === 0 || other.hand.length === 0) continue

      const myIdx = randomInt(0, player.hand.length - 1)
      const otherIdx = randomInt(0, other.hand.length - 1)

      const myCard = player.hand.splice(myIdx, 1)[0]
      const otherCard = other.hand.splice(otherIdx, 1)[0]

      player.hand.push(otherCard)
      other.hand.push(myCard)
      swapCount++
    }

    addLog(state, player.id, `何意味: 与${swapCount}名玩家交换了手牌`)
    return { success: true, message: `与${swapCount}名玩家交换了手牌` }
  }

  /** B0015 灵魂互换: Swap positions of two deployed characters */
  private instantSwapPositions(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { charUid1, charUid2 } = params
    if (!charUid1 || !charUid2) return { success: false, message: '需要指定两个角色' }

    const info1 = this.findDeployedChar(player, charUid1)
    const info2 = this.findDeployedChar(player, charUid2)
    if (!info1 || !info2) return { success: false, message: '未找到目标角色' }

    // Swap characters between slots
    const char1 = player.deployed[info1.slotIndex].character
    const char2 = player.deployed[info2.slotIndex].character
    player.deployed[info1.slotIndex].character = char2
    player.deployed[info2.slotIndex].character = char1

    addLog(state, player.id, `灵魂互换: ${this.getCharName(info1.char)} ↔ ${this.getCharName(info2.char)}`)
    return { success: true, message: '位置已互换' }
  }

  /** B0016 是不想说话吗: Silence a target character */
  private instantSilenceTarget(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId, targetCharUid } = params
    if (!targetPlayerId || !targetCharUid) return { success: false, message: '需要指定目标' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const info = this.findDeployedChar(targetPlayer, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    info.char.silenced = true
    info.char.debuffs.push({
      type: 'silence',
      value: 1,
      remainingTurns: 2,
      source: 'silenceCard',
    })

    addLog(state, player.id, `${this.getCharName(info.char)}被沉默`)
    return { success: true, message: `${this.getCharName(info.char)}已被沉默` }
  }

  /** C0001 视奸: View target player's hand */
  private instantViewHand(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    const handInfo = targetPlayer.hand.map(c => {
      const charDef = getCharacterDef(c.cardId)
      const stratDef = this.deckService.getStrategyCardDef(c.cardId)
      return charDef?.name ?? stratDef?.name ?? c.cardId
    }).join(', ')

    addLog(state, player.id, `视奸: ${targetPlayer.name}的手牌为 [${handInfo}]`)
    return { success: true, message: `${targetPlayer.name}的手牌: [${handInfo}]` }
  }

  /** C0002 老虎机: Random effect */
  private instantSlotMachine(state: GameState, player: PlayerState): { success: boolean; message: string } {
    const roll = this.diceService.rollDice(6)
    let msg = ''

    switch (roll) {
      case 1: // 1 damage to random enemy
        {
          const enemies = state.players.filter(p => p.id !== player.id && p.isAlive)
          if (enemies.length > 0) {
            const target = enemies[randomInt(0, enemies.length - 1)]
            target.hp -= 1
            msg = `老虎机: 对${target.name}造成1点伤害`
          }
        }
        break
      case 2: // Heal 1 HP
        player.hp = Math.min(player.hp + 1, player.maxHp)
        msg = '老虎机: 恢复1点体力'
        break
      case 3: // Draw 1 card
        if (state.actionDeck.length > 0) {
          const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 1)
          player.hand.push(...drawn)
          state.actionDeck = remaining
          msg = '老虎机: 摸1张牌'
        }
        break
      case 4: // +1 armor to all own characters
        for (const slot of player.deployed) {
          if (slot.character && slot.character.state === 'normal') {
            slot.character.armor += 1
          }
        }
        msg = '老虎机: 所有角色+1护甲'
        break
      case 5: // 2 damage to self
        player.hp -= 2
        msg = '老虎机: 自己受到2点伤害'
        break
      case 6: // Draw 2 cards
        if (state.actionDeck.length > 0) {
          const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 2)
          player.hand.push(...drawn)
          state.actionDeck = remaining
          msg = '老虎机: 摸2张牌'
        }
        break
    }

    addLog(state, player.id, msg)
    return { success: true, message: msg }
  }

  /** C0005 恩！情！: All players draw 1 card */
  private instantAllPlayersDraw(state: GameState, player: PlayerState): { success: boolean; message: string } {
    let drawCount = 0
    for (const p of state.players) {
      if (p.isAlive && state.actionDeck.length > 0) {
        const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 1)
        p.hand.push(...drawn)
        state.actionDeck = remaining
        drawCount += drawn.length
      }
    }

    addLog(state, player.id, `恩！情！: 所有玩家摸了${drawCount}张牌`)
    return { success: true, message: `所有玩家各摸了1张牌` }
  }

  /** C0006 屹立不倒: Protect near-death character from dying */
  private instantProtectNearDeath(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    if (info.char.state !== 'nearDeath') {
      return { success: false, message: '该角色不在濒死状态' }
    }

    info.char.state = 'normal'
    info.char.currentHp = 1
    addLog(state, player.id, `${this.getCharName(info.char)}屹立不倒！`)
    return { success: true, message: `${this.getCharName(info.char)}从濒死中恢复` }
  }

  /** C0008 灵光一闪: 1/2 chance to ignore next skill targeting allies */
  private instantChanceIgnoreSkill(state: GameState, player: PlayerState): { success: boolean; message: string } {
    const success = this.diceService.probabilityCheck('1/2')
    if (success) {
      // Grant ignoreNextSkill buff to all deployed allies
      for (const slot of player.deployed) {
        if (slot.character && slot.character.state !== 'retired') {
          slot.character.buffs.push({
            type: 'ignoreNextSkill',
            value: 1,
            remainingTurns: 1,
            source: 'C0008',
          })
        }
      }
      addLog(state, player.id, '灵光一闪: 成功！下次技能无效')
      return { success: true, message: '灵光一闪: 下次技能无效' }
    }
    addLog(state, player.id, '灵光一闪: 失败')
    return { success: true, message: '灵光一闪: 判定失败' }
  }

  /** C0012 做了！: Weaken two targets */
  private instantWeakenTwoTargets(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid1, targetCharUid2, targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    let weakened = 0
    for (const uid of [targetCharUid1, targetCharUid2]) {
      if (!uid) continue
      const info = this.findDeployedChar(targetPlayer, uid)
      if (info) {
        info.char.debuffs.push({
          type: 'weaken',
          value: 2,
          remainingTurns: 2,
          source: 'weakenCard',
        })
        weakened++
      }
    }

    addLog(state, player.id, `做了！: 削弱了${weakened}个角色`)
    return { success: true, message: `削弱了${weakened}个角色` }
  }

  /** C0015 Fever!!!!!: Special effect if 5 characters of same faction */
  private instantFeverEffect(state: GameState, player: PlayerState): { success: boolean; message: string } {
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
          slot.character.buffs.push({ type: 'fever', value: 2, remainingTurns: 2, source: 'fever' })
        }
      }
      addLog(state, player.id, 'Fever!!!!!: 5名同阵营角色！全队回满+攻击+2')
      return { success: true, message: 'Fever!!!!! 全队回满+攻击+2' }
    }

    addLog(state, player.id, 'Fever!!!!!: 未达成5名同阵营角色条件')
    return { success: false, message: 'Fever!!!!! 未达成条件（需要5名同阵营角色）' }
  }

  /** D0002 回收站: Retrieve a card from discard pile */
  private instantRetrieveFromDiscard(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCardUid } = params

    let card: CardInstance | undefined
    if (targetCardUid) {
      card = player.discardPile.find(c => c.uid === targetCardUid)
    } else {
      card = player.discardPile[0]
    }

    if (!card) return { success: false, message: '弃牌堆为空' }

    const idx = player.discardPile.findIndex(c => c.uid === card!.uid)
    player.discardPile.splice(idx, 1)
    player.hand.push(card)

    const def = this.deckService.getStrategyCardDef(card.cardId)
    const charDef = getCharacterDef(card.cardId)
    const name = def?.name ?? charDef?.name ?? card.cardId
    addLog(state, player.id, `回收站: 取回了${name}`)
    return { success: true, message: `取回了${name}` }
  }

  /** D0004 我是纯良: Force earthStore on an ally */
  private instantForceEarthStore(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    if (!info.char.keywords.includes('earthStore')) {
      info.char.keywords.push('earthStore')
    }

    addLog(state, player.id, `${this.getCharName(info.char)}获得地藏`)
    return { success: true, message: `${this.getCharName(info.char)}获得地藏` }
  }

  /** D0006 禁止947: Draw cards and remove evil cards */
  private instantDrawAndRemoveEvil(state: GameState, player: PlayerState): { success: boolean; message: string } {
    if (state.actionDeck.length > 0) {
      const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 2)
      player.hand.push(...drawn)
      state.actionDeck = remaining
      addLog(state, player.id, `禁止947: 摸了${drawn.length}张牌`)
      return { success: true, message: `摸了${drawn.length}张牌` }
    }
    return { success: false, message: '牌堆为空' }
  }

  /** D0009 巴巴恩波神之力: Remove debuffs from a character */
  private instantRemoveDebuff(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) return { success: false, message: '需要指定目标角色' }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: '未找到目标角色' }

    const debuffCount = info.char.debuffs.length
    info.char.debuffs = []
    info.char.silenced = false

    addLog(state, player.id, `${this.getCharName(info.char)}清除了${debuffCount}个减益`)
    return { success: true, message: `清除了${debuffCount}个减益效果` }
  }

  /** D0011 啥是XXX / C0011 不仲蕾: Disable faction skill */
  private instantDisableFactionSkill(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    const { targetPlayerId } = params
    if (!targetPlayerId) return { success: false, message: '需要指定目标玩家' }

    const targetPlayer = state.players.find(p => p.id === targetPlayerId)
    if (!targetPlayer) return { success: false, message: '未找到目标玩家' }

    // Mark all target's characters as silenced
    for (const slot of targetPlayer.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        slot.character.silenced = true
        slot.character.debuffs.push({
          type: 'silence',
          value: 1,
          remainingTurns: 2,
          source: 'disableFactionSkill',
        })
      }
    }

    addLog(state, player.id, `${targetPlayer.name}的阵营技能被禁用`)
    return { success: true, message: `${targetPlayer.name}的阵营技能被禁用` }
  }

  /** D0012 绿接粉: Counter next enemy skill */
  private instantCounterSkill(state: GameState, player: PlayerState, params: Record<string, any>): { success: boolean; message: string } {
    // Mark all deployed characters with a counterSkill buff
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        slot.character.buffs.push({
          type: 'counterSkill',
          value: 1,
          remainingTurns: 1,
          source: 'D0012',
        })
      }
    }
    addLog(state, player.id, '绿接粉: 已准备反击下次技能')
    return { success: true, message: '已准备反击下次技能' }
  }

  /** A0011 世界守护者: Maintain faction skill (self buff) */
  private instantMaintainFactionSkill(state: GameState, player: PlayerState): { success: boolean; message: string } {
    // Grant silence immunity to all own characters
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        slot.character.buffs.push({
          type: 'silenceImmunity',
          value: 1,
          remainingTurns: 3,
          source: 'worldGuardian',
        })
      }
    }
    addLog(state, player.id, '世界守护者: 全队沉默免疫3回合')
    return { success: true, message: '全队沉默免疫3回合' }
  }
}
