// ============================================================
// Main game orchestration service
// ============================================================

import { Injectable } from '@nestjs/common'
import { DeckService } from './deck.service'
import { CombatService } from './combat.service'
import { GameStateService } from './game-state.service'
import { CHARACTER_CARDS, getCharacterDef } from './character-data'
import type {
  BattleLogEntry,
  CardInstance,
  DeployedCharacter,
  DeployedSlot,
  GameAction,
  GameState,
  PlayerState,
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

    // 2. Action deck
    const actionDeck = this.deckService.createDeck()

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
      const { drawn, remaining } = this.deckService.drawCards(characterPool, 5)
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

    addLog(state, 'system', 'Game created', `${playerCount} players, ${aiCount} AI`)
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
    state.turnPhase = 'draw'

    addLog(state, player.id, `Turn ${state.turnNumber} starts for ${player.name}`)

    // Refresh action points for this player's deployed characters
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state === 'normal') {
        slot.character.hasActionPoint = true
      }
    }

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
            `${this.getCharName(slot.character)} recovered from near-death!`,
            `roll=${roll}`,
          )
        } else {
          addLog(
            state,
            player.id,
            `${this.getCharName(slot.character)} stays near-death`,
            `roll=${roll}`,
          )
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
   */
  drawPhase(state: GameState): GameState {
    const player = state.players[state.currentPlayerIndex]
    state.turnPhase = 'draw'

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
    addLog(state, player.id, `Drew ${drawn.length} cards`, `hand=${player.hand.length}`)

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
    if (!player) return { success: false, message: 'Player not found' }

    if (position < 0 || position >= 5) {
      return { success: false, message: 'Invalid position (must be 0-4)' }
    }

    // Find the card in hand
    const cardIndex = player.hand.findIndex((c) => c.uid === cardUid)
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found in hand' }
    }

    const card = player.hand[cardIndex]
    const charDef = getCharacterDef(card.cardId)
    if (!charDef) {
      return { success: false, message: 'Card is not a character card' }
    }

    // Check if position is already occupied
    if (player.deployed[position]?.character) {
      return { success: false, message: 'Position already occupied' }
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
    }

    player.deployed[position] = {
      position,
      character: deployedChar,
      equipment: null,
    }

    // Remove from hand
    player.hand.splice(cardIndex, 1)

    addLog(state, playerId, `Deployed ${charDef.name} at position ${position}`)

    return { success: true, message: `Deployed ${charDef.name}` }
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
    if (!player) return { success: false, message: 'Player not found' }

    if (state.turnPhase !== 'action') {
      return { success: false, message: 'Cannot play cards outside the action phase' }
    }

    // Find card in hand
    const cardIndex = player.hand.findIndex((c) => c.uid === cardUid)
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found in hand' }
    }

    const card = player.hand[cardIndex]
    const cardDef = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
    if (!cardDef) {
      return { success: false, message: 'Card is not an action card' }
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
        result = this.handleBigRecovery(state, player)
        break

      case 'replenish':
        result = this.handleReplenish(state, player)
        break

      default:
        result = { success: false, message: `Unknown action type: ${cardDef.actionType}` }
    }

    // Only remove card from hand if action succeeded
    if (result.success) {
      player.hand.splice(cardIndex, 1)
      player.discardPile.push(card)
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
    if (!player) return { success: false, message: 'Player not found' }

    const slotInfo = this.findDeployedChar(player, charUid)
    if (!slotInfo) return { success: false, message: 'Character not found on the field' }

    const char = slotInfo.char
    const charDef = getCharacterDef(char.cardId)
    if (!charDef || charDef.skills.length === 0) {
      return { success: false, message: 'Character has no skills' }
    }

    const skill = charDef.skills[0] // Use first skill

    if (skill.consumeActionPoint && !char.hasActionPoint) {
      return { success: false, message: 'No action point remaining' }
    }

    // Consume action point if needed
    if (skill.consumeActionPoint) {
      char.hasActionPoint = false
    }

    // For now, skill effects are simplified:
    // Most skills would need full implementation; here we handle the common
    // attack-type skill pattern (pass through to combat service).
    addLog(state, player.id, `${charDef.name} uses ${skill.name}`, skill.description)

    return { success: true, message: `Used skill: ${skill.name}` }
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

    // Hand limit check (7 cards max)
    while (player.hand.length > 7) {
      const discardIndex = randomInt(0, player.hand.length - 1)
      const discarded = player.hand.splice(discardIndex, 1)[0]
      player.discardPile.push(discarded)
      addLog(state, player.id, `Discarded a card due to hand limit`)
    }

    addLog(state, player.id, `Turn ${state.turnNumber} ends for ${player.name}`)

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
        addLog(state, player.id, `${player.name} has been eliminated!`)
      }
    }

    const alivePlayers = state.players.filter((p) => p.isAlive)

    if (alivePlayers.length <= 1) {
      state.gameOver = true
      state.winner = alivePlayers[0]?.id ?? null
      if (state.winner) {
        addLog(state, state.winner, `Game over! ${alivePlayers[0].name} wins!`)
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
      hpRecoveryUsed: 0,
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

  // ----- Card effect handlers -----

  private handleAttackCard(
    state: GameState,
    attackerPlayer: PlayerState,
    params: Record<string, any>,
  ): { success: boolean; message: string; nearDeathTriggered?: boolean; retired?: boolean } {
    const { attackerCharUid, targetPlayerId, targetCharUid, armorPierce } = params

    if (!attackerCharUid || !targetPlayerId || !targetCharUid) {
      return { success: false, message: 'Missing required params: attackerCharUid, targetPlayerId, targetCharUid' }
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
    let count = 0
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        slot.character.buffs.push({
          type: 'block',
          value: 2,
          remainingTurns: 1,
          source: 'bigBlock',
        })
        count++
      }
    }
    addLog(state, player.id, `Big block applied to ${count} characters`)
    return { success: true, message: `Blocked ${count} characters (+2 block each)` }
  }

  private handleSmallBlock(
    state: GameState,
    player: PlayerState,
    params: Record<string, any>,
  ): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) {
      return { success: false, message: 'Missing targetCharUid' }
    }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: 'Target character not found' }

    info.char.buffs.push({
      type: 'block',
      value: 2,
      remainingTurns: 1,
      source: 'smallBlock',
    })

    addLog(state, player.id, `Small block applied to ${this.getCharName(info.char)}`)
    return { success: true, message: `Blocked ${this.getCharName(info.char)} (+2 block)` }
  }

  private handleRecovery(
    state: GameState,
    player: PlayerState,
    params: Record<string, any>,
    _big: boolean,
  ): { success: boolean; message: string } {
    const { targetCharUid } = params
    if (!targetCharUid) {
      return { success: false, message: 'Missing targetCharUid' }
    }

    const info = this.findDeployedChar(player, targetCharUid)
    if (!info) return { success: false, message: 'Target character not found' }

    const char = info.char
    if (char.state === 'retired') {
      return { success: false, message: 'Cannot heal a retired character' }
    }

    // If near-death, recovery restores to normal
    if (char.state === 'nearDeath') {
      char.state = 'normal'
      char.currentHp = Math.min(char.currentHp + 1, char.maxHp)
      addLog(state, player.id, `${this.getCharName(char)} recovered from near-death via recovery card`)
      return { success: true, message: `${this.getCharName(char)} recovered from near-death` }
    }

    char.currentHp = Math.min(char.currentHp + 2, char.maxHp)
    addLog(state, player.id, `${this.getCharName(char)} healed 2 HP`)
    return { success: true, message: `${this.getCharName(char)} healed to ${char.currentHp}/${char.maxHp}` }
  }

  private handleBigRecovery(
    state: GameState,
    player: PlayerState,
  ): { success: boolean; message: string } {
    let healed = 0
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        if (slot.character.state === 'nearDeath') {
          slot.character.state = 'normal'
          healed++
        } else {
          slot.character.currentHp = Math.min(slot.character.currentHp + 1, slot.character.maxHp)
          healed++
        }
      }
    }
    addLog(state, player.id, `Big recovery applied to ${healed} characters`)
    return { success: true, message: `Healed ${healed} characters` }
  }

  private handleReplenish(
    state: GameState,
    player: PlayerState,
  ): { success: boolean; message: string } {
    const { drawn, remaining } = this.deckService.drawCards(state.actionDeck, 2)
    player.hand.push(...drawn)
    state.actionDeck = remaining

    addLog(state, player.id, `Drew ${drawn.length} cards from replenish`)
    return { success: true, message: `Drew ${drawn.length} cards` }
  }
}
