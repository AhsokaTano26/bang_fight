import { AiService } from '../ai.service'
import { CombatService } from '../combat.service'
import { DeckService } from '../deck.service'
import { DiceService } from '../dice.service'
import { GameService } from '../game.service'
import { GameStateService } from '../game-state.service'
import { getCharacterDef } from '../character-data'
import type { CardInstance, DeployedCharacter, GameState, PlayerState } from '../types'

export const card = (cardId: string, uid = cardId): CardInstance => ({
  cardId,
  uid,
  suit: 'hearts',
})

export function character(
  uid: string,
  overrides: Partial<DeployedCharacter> = {},
): DeployedCharacter {
  return {
    uid,
    cardId: 'PAS1001',
    currentHp: 10,
    maxHp: 10,
    attack: 2,
    state: 'normal',
    hasActionPoint: true,
    armor: 0,
    buffs: [],
    debuffs: [],
    keywords: [],
    silenced: false,
    ...overrides,
  }
}

export function player(id: string): PlayerState {
  return {
    id,
    name: id,
    hp: 20,
    maxHp: 20,
    isAlive: true,
    isAi: id === 'ai',
    hand: [],
    deployed: Array.from({ length: 5 }, (_, position) => ({
      position,
      character: position === 0 ? character(`${id}-char`) : null,
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

export function fixture() {
  const deck = new DeckService()
  const combat = new CombatService()
  const store = new GameStateService()
  const game = new GameService(deck, combat, store, new DiceService())
  const ai = new AiService(game, deck, combat)
  const state: GameState = {
    gameId: 'test',
    players: [player('ai'), player('human')],
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnPhase: 'action',
    characterPool: [],
    actionDeck: [],
    strategyDeck: [],
    pendingEffects: [],
    battleLog: [],
    winner: null,
    gameOver: false,
  }
  return { deck, combat, store, game, ai, state, own: state.players[0], enemy: state.players[1] }
}

export function deployedCard(cardId: string, uid = cardId): DeployedCharacter {
  const def = getCharacterDef(cardId)!
  return character(uid, {
    cardId,
    currentHp: def.maxHp,
    maxHp: def.maxHp,
    attack: def.attack,
    keywords: [...def.keywords],
  })
}
