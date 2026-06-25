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
// Debuff types
// ------------------------------------------------------------

export type DebuffType =
  | 'skipDraw'      // 跳过摸牌
  | 'skipAction'    // 跳过行动
  | 'loseAbility'   // 失去行动能力
  | 'silence'       // 沉默（无法使用技能）
  | 'weaken'        // 虚弱（攻击力-2）
  | 'disarm'        // 缴械（无法攻击）

// ------------------------------------------------------------
// Keyword types
// ------------------------------------------------------------

export type KeywordType =
  | 'guardian'        // 守护：替相邻角色承受攻击
  | 'counter'         // 反击：被攻击后反击攻击者
  | 'aoeAttack'       // 群攻：攻击所有敌方角色
  | 'veteran'         // 历战：受伤后下次攻击+2
  | 'immunity'        // 免伤：不受伤害
  | 'untargetable'    // 不可选中：无法被选为目标
  | 'earthStore'      // 地藏：濒死时保留1HP
  | 'spread'          // 扩散：伤害扩散到相邻角色
  | 'armorPierce'     // 穿甲：无视护甲
  | 'silenceImmunity' // 沉默免疫
  | 'ignoreGuardian'  // 无视守护
  | 'counterSilence'  // 反击沉默

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
  keywords: KeywordType[]
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

// ------------------------------------------------------------
// Strategy card types
// ------------------------------------------------------------

export type StrategyType = 'deployable' | 'instant'

export type EquipEffectType =
  | 'attackBoost'
  | 'hpBoost'
  | 'armorBoost'
  | 'handLimitBoost'
  | 'grantKeyword'
  | 'silenceImmunity'
  | 'armorPierceOnAttack'
  | 'nearDeathRecover'
  | 'unTargetable'
  | 'critOnAttack'
  | 'ignoreGuardian'
  | 'counterSilence'
  | 'forceRetireOnHit'
  | 'conditionalBonus'

export interface EquipEffect {
  type: EquipEffectType
  value?: number
  keyword?: KeywordType
  condition?: string
}

export interface JudgmentEffect {
  type: 'suitCheck' | 'probabilityCheck' | 'moveToNext'
  suitCondition?: string
  onFail?: string
  onSuccess?: string
}

export interface StrategyCardDef {
  id: string
  name: string
  category: 'strategy'
  strategyType: StrategyType
  imageFile: string
  description: string
  requiresTarget: boolean
  equipEffects?: EquipEffect[]
  instantType?: string
  judgmentEffect?: JudgmentEffect
}

export type CardDef = CharacterCardDef | ActionCardDef | StrategyCardDef

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
  judgmentZone: CardInstance[]

  hpRecoveryUsed: number // how many times player recovered HP this turn (max 2)
  apUsedThisTurn: number // how many characters have used AP this turn (max 3)
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
  keywords: KeywordType[]
  silenced: boolean
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
  sourcePlayerId?: string
  targetPlayerId?: string
  remainingTurns?: number
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
