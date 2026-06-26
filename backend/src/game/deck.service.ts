// ============================================================
// Deck management service
// ============================================================

import { Injectable } from '@nestjs/common'
import type { ActionCardDef, CardInstance, Suit, StrategyCardDef } from './types'
import { STRATEGY_CARDS } from './strategy-data'

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

function randomId(): string {
  // Use a simple UUID-like random string without external dependency
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  return Array.from({ length: 36 }, (_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return '-'
    return hex()
  }).join('')
}

// ------------------------------------------------------------
// Action card definitions (28 cards: 4x each type)
// ------------------------------------------------------------

const ACTION_CARD_DEFS: ActionCardDef[] = [
  // Attack x4
  { id: 'ATK_1', name: '肘击', category: 'action', actionType: 'attack', requiresTarget: true, affectsAll: false },
  { id: 'ATK_2', name: '肘击', category: 'action', actionType: 'attack', requiresTarget: true, affectsAll: false },
  { id: 'ATK_3', name: '肘击', category: 'action', actionType: 'attack', requiresTarget: true, affectsAll: false },
  { id: 'ATK_4', name: '肘击', category: 'action', actionType: 'attack', requiresTarget: true, affectsAll: false },
  // Armor Pierce x4
  { id: 'ARMOR_1', name: '破甲攻击', category: 'action', actionType: 'armorPierce', requiresTarget: true, affectsAll: false, armorPierce: true },
  { id: 'ARMOR_2', name: '破甲攻击', category: 'action', actionType: 'armorPierce', requiresTarget: true, affectsAll: false, armorPierce: true },
  { id: 'ARMOR_3', name: '破甲攻击', category: 'action', actionType: 'armorPierce', requiresTarget: true, affectsAll: false, armorPierce: true },
  { id: 'ARMOR_4', name: '破甲攻击', category: 'action', actionType: 'armorPierce', requiresTarget: true, affectsAll: false, armorPierce: true },
  // Big Block x4
  { id: 'BIG_BLOCK_1', name: '防御', category: 'action', actionType: 'bigBlock', requiresTarget: false, affectsAll: true },
  { id: 'BIG_BLOCK_2', name: '防御', category: 'action', actionType: 'bigBlock', requiresTarget: false, affectsAll: true },
  { id: 'BIG_BLOCK_3', name: '防御', category: 'action', actionType: 'bigBlock', requiresTarget: false, affectsAll: true },
  { id: 'BIG_BLOCK_4', name: '防御', category: 'action', actionType: 'bigBlock', requiresTarget: false, affectsAll: true },
  // Small Block x4
  { id: 'SMALL_BLOCK_1', name: '格挡', category: 'action', actionType: 'smallBlock', requiresTarget: true, affectsAll: false },
  { id: 'SMALL_BLOCK_2', name: '格挡', category: 'action', actionType: 'smallBlock', requiresTarget: true, affectsAll: false },
  { id: 'SMALL_BLOCK_3', name: '格挡', category: 'action', actionType: 'smallBlock', requiresTarget: true, affectsAll: false },
  { id: 'SMALL_BLOCK_4', name: '格挡', category: 'action', actionType: 'smallBlock', requiresTarget: true, affectsAll: false },
  // Recovery x4
  { id: 'RECOVERY_1', name: '回复', category: 'action', actionType: 'recovery', requiresTarget: true, affectsAll: false },
  { id: 'RECOVERY_2', name: '回复', category: 'action', actionType: 'recovery', requiresTarget: true, affectsAll: false },
  { id: 'RECOVERY_3', name: '回复', category: 'action', actionType: 'recovery', requiresTarget: true, affectsAll: false },
  { id: 'RECOVERY_4', name: '回复', category: 'action', actionType: 'recovery', requiresTarget: true, affectsAll: false },
  // Big Recovery x4
  { id: 'BIG_RECOVERY_1', name: '回复大', category: 'action', actionType: 'bigRecovery', requiresTarget: false, affectsAll: true },
  { id: 'BIG_RECOVERY_2', name: '回复大', category: 'action', actionType: 'bigRecovery', requiresTarget: false, affectsAll: true },
  { id: 'BIG_RECOVERY_3', name: '回复大', category: 'action', actionType: 'bigRecovery', requiresTarget: false, affectsAll: true },
  { id: 'BIG_RECOVERY_4', name: '回复大', category: 'action', actionType: 'bigRecovery', requiresTarget: false, affectsAll: true },
  // Replenish x4
  { id: 'REPLENISH_1', name: '补充', category: 'action', actionType: 'replenish', requiresTarget: false, affectsAll: false },
  { id: 'REPLENISH_2', name: '补充', category: 'action', actionType: 'replenish', requiresTarget: false, affectsAll: false },
  { id: 'REPLENISH_3', name: '补充', category: 'action', actionType: 'replenish', requiresTarget: false, affectsAll: false },
  { id: 'REPLENISH_4', name: '补充', category: 'action', actionType: 'replenish', requiresTarget: false, affectsAll: false },

  // V1.1: 肘+20 x20 (5 per suit) — 普通攻击牌，+20表示增加了20张
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `ATK20_${i + 1}`,
    name: '肘击',
    category: 'action' as const,
    actionType: 'attack' as const,
    requiresTarget: true,
    affectsAll: false,
  })),
  // V1.1: 破+4 x4 (1 per suit) — 普通破甲牌，+4表示增加了4张
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `ARMOR4_${i + 1}`,
    name: '破甲攻击',
    category: 'action' as const,
    actionType: 'armorPierce' as const,
    requiresTarget: true,
    affectsAll: false,
    armorPierce: true,
  })),
]

// ------------------------------------------------------------
// Strategy card definitions (64 cards from strategy-data.ts)
// ------------------------------------------------------------

const STRATEGY_CARD_DEFS: readonly StrategyCardDef[] = STRATEGY_CARDS

// ------------------------------------------------------------
// Service
// ------------------------------------------------------------

@Injectable()
export class DeckService {
  /** All action card definitions available in the game. */
  readonly actionCardDefs: readonly ActionCardDef[] = ACTION_CARD_DEFS

  /** All strategy card definitions available in the game. */
  readonly strategyCardDefs: readonly StrategyCardDef[] = STRATEGY_CARD_DEFS

  /**
   * Fisher-Yates shuffle (in-place, returns the same array).
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /**
   * Draw N cards from the top of a deck.
   * Returns { drawn, remaining } -- drawn may be shorter than count if the
   * deck is low.
   */
  drawCards(deck: CardInstance[], count: number): { drawn: CardInstance[]; remaining: CardInstance[] } {
    const drawn = deck.slice(0, count)
    const remaining = deck.slice(count)
    return { drawn, remaining }
  }

  /**
   * Create a CardInstance from a card definition.
   */
  createCardInstance(cardId: string): CardInstance {
    return {
      uid: randomId(),
      cardId,
      suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    }
  }

  /**
   * Create a shuffled action deck (52 cards: 28 original + 20 肘+20 + 4 破+4).
   */
  createDeck(): CardInstance[] {
    const deck = ACTION_CARD_DEFS.map((def) => this.createCardInstance(def.id))
    return this.shuffle(deck)
  }

  /**
   * Create a mixed deck: 52 action cards + 76 strategy cards = 128 cards.
   */
  createMixedDeck(): CardInstance[] {
    const actionCards = ACTION_CARD_DEFS.map((def) => this.createCardInstance(def.id))
    const strategyCards = STRATEGY_CARD_DEFS.map((def) => this.createCardInstance(def.id))
    return this.shuffle([...actionCards, ...strategyCards])
  }

  /**
   * Look up a strategy card definition by its card ID.
   */
  getStrategyCardDef(cardId: string): StrategyCardDef | undefined {
    return STRATEGY_CARD_DEFS.find((def) => def.id === cardId)
  }
}
