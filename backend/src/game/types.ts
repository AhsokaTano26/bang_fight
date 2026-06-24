// ============================================================
// Game state types for 邦邦武斗传 (Bang Bang Fight)
// Backend copy -- kept in sync with frontend/src/types/
// ============================================================

// ------------------------------------------------------------
// Card categories
// ------------------------------------------------------------

export type CardCategory = 'character' | 'action' | 'strategy' | 'auxiliary'

export type Faction = 'AG' | 'HHW' | 'PAS' | 'PPP' | 'ROS'

export type ActionCardType =
  | 'attack'
  | 'armorPierce'
  | 'bigBlock'
  | 'smallBlock'
  | 'recovery'
  | 'bigRecovery'
  | 'replenish'

export type CharacterState = 'normal' | 'nearDeath' | 'retired'

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

// ------------------------------------------------------------
// Card definitions (static data)
// ------------------------------------------------------------

export interface CharacterSkill {
  name: string
  description: string
  consumeActionPoint: boolean
  effect: SkillEffect
}

export interface SkillEffect {
  type: string
  params: Record<string, any>
}

export interface CharacterCardDef {
  id: string
  name: string
  category: 'character'
  faction: Faction
  maxHp: number
  attack: number
  skills: CharacterSkill[]
}

export interface ActionCardDef {
  id: string
  name: string
  category: 'action'
  actionType: ActionCardType
  requiresTarget: boolean
  affectsAll: boolean
  armorPierce?: boolean
}

export type CardDef = CharacterCardDef | ActionCardDef

// ------------------------------------------------------------
// Card instance (runtime, per-game)
// ------------------------------------------------------------

export interface CardInstance {
  uid: string   // runtime unique id (generated each game)
  cardId: string // references CardDef.id
  suit: Suit
}

// ------------------------------------------------------------
// Turn phases
// ------------------------------------------------------------

export type TurnPhase = 'judgment' | 'draw' | 'action' | 'discard' | 'ended'

// ------------------------------------------------------------
// Player state
// ------------------------------------------------------------

export interface PlayerState {
  id: string
  name: string
  hp: number
  maxHp: number
  isAlive: boolean
  isAi: boolean

  hand: CardInstance[]
  deployed: DeployedSlot[]
  graveyard: CardInstance[]
  discardPile: CardInstance[]

  hpRecoveryUsed: number // how many times player recovered HP this turn (max 2)
}

export interface DeployedSlot {
  position: number
  character: DeployedCharacter | null
  equipment: CardInstance | null
}

export interface DeployedCharacter {
  uid: string
  cardId: string
  currentHp: number
  maxHp: number
  attack: number
  state: CharacterState
  hasActionPoint: boolean
  armor: number
  buffs: Buff[]
  debuffs: Debuff[]
}

// ------------------------------------------------------------
// Buffs & Debuffs
// ------------------------------------------------------------

export interface Buff {
  type: string
  value: number
  remainingTurns: number
  source: string
}

export interface Debuff {
  type: string
  value: number
  remainingTurns: number
  source: string
}

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------

export interface GameState {
  gameId: string
  players: PlayerState[]
  currentPlayerIndex: number
  turnNumber: number
  turnPhase: TurnPhase

  characterPool: CardInstance[]
  actionDeck: CardInstance[]
  strategyDeck: CardInstance[]

  pendingEffects: PendingEffect[]
  battleLog: BattleLogEntry[]

  winner: string | null
  gameOver: boolean
}

// ------------------------------------------------------------
// Pending effects & battle log
// ------------------------------------------------------------

export interface PendingEffect {
  id: string
  type: string
  source: string
  target: string
  params: Record<string, any>
  resolved: boolean
}

export interface BattleLogEntry {
  turn: number
  phase: TurnPhase
  playerId: string
  action: string
  details?: string
  timestamp: number
}

// ------------------------------------------------------------
// API types (frontend <-> backend)
// ------------------------------------------------------------

export interface GameAction {
  type: string
  playerId: string
  params: Record<string, any>
}

export interface GameResponse {
  success: boolean
  state: Partial<GameState>
  errors?: string[]
}
