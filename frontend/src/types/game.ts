// ============================================================
// Game state types for 邦邦武斗传
// ============================================================

import type { CardInstance } from './card'
import type { CharacterState, DebuffType, KeywordType } from './card'

// Re-export for convenience
export type { DebuffType, KeywordType }

// ============================================================
// Turn phases
// ============================================================

export type TurnPhase = 'judgment' | 'draw' | 'action' | 'discard' | 'ended'

// ============================================================
// Player state
// ============================================================

export interface PlayerState {
  id: string              // 玩家ID ("player" | "ai_1" | "ai_2")
  name: string            // 显示名称
  hp: number              // 体力值 (初始10)
  maxHp: number           // 最大体力值
  isAlive: boolean        // 是否存活
  isAi: boolean           // 是否为AI

  hand: CardInstance[]    // 手牌 (角色牌+行动牌+策略牌)
  deployed: DeployedSlot[] // 部署区 (最多5个位置)
  graveyard: CardInstance[] // 休息室 (退场的角色牌)
  discardPile: CardInstance[] // 弃牌堆
  judgmentZone: CardInstance[] // 判定区

  hpRecoveryUsed: number  // 本回合已使用体力值补充角色次数 (每回合上限2)
  apUsedThisTurn: number  // 本回合已使用行动点的角色数 (每回合上限3)
}

export interface DeployedSlot {
  position: number        // 部署位置 (0-4)
  character: DeployedCharacter | null
  equipment: CardInstance | null  // 装备的道具牌
}

export interface DeployedCharacter {
  uid: string             // 角色实例ID
  cardId: string          // 角色牌ID
  currentHp: number       // 当前血量
  maxHp: number           // 最大血量
  attack: number          // 当前攻击力 (可能因技能变化)
  state: CharacterState   // 角色状态
  hasActionPoint: boolean // 本回合是否有行动点
  armor: number           // 护甲值
  buffs: Buff[]           // 增益效果
  debuffs: Debuff[]       // 减益效果
  keywords: KeywordType[] // 角色关键词
  silenced: boolean       // 是否被沉默
}

// ============================================================
// Buffs & Debuffs
// ============================================================

export interface Buff {
  type: string            // e.g. "attackBoost", "immunity", "untargetable"
  value: number           // 效果数值
  remainingTurns: number  // 剩余回合数 (-1 = 永久)
  source: string          // 来源标识
}

export interface Debuff {
  type: string            // e.g. "weaken", "silence", "disarm"
  value: number
  remainingTurns: number
  source: string
}

// ============================================================
// Game state
// ============================================================

export interface GameState {
  gameId: string
  players: PlayerState[]
  currentPlayerIndex: number  // 当前行动玩家索引
  turnNumber: number          // 当前回合数
  turnPhase: TurnPhase        // 当前阶段

  characterPool: CardInstance[]  // 角色池 (可抽取的角色牌)
  actionDeck: CardInstance[]     // 行动牌堆
  strategyDeck: CardInstance[]   // 策略牌堆

  pendingEffects: PendingEffect[]  // 待处理的效果队列
  battleLog: BattleLogEntry[]      // 战斗日志

  winner: string | null       // 获胜者ID (null = 游戏进行中)
  gameOver: boolean           // 游戏是否结束
}

// ============================================================
// Pending effects & battle log
// ============================================================

export interface PendingEffect {
  id: string
  type: string               // 效果类型
  source: string             // 来源 (玩家ID)
  target: string             // 目标 (玩家ID)
  params: Record<string, any>
  resolved: boolean
}

export interface BattleLogEntry {
  turn: number
  phase: TurnPhase
  playerId: string
  action: string             // 操作描述
  details?: string           // 详细信息
  timestamp: number
}

// ============================================================
// API types (frontend ↔ backend)
// ============================================================

export interface GameAction {
  type: string               // 动作类型
  playerId: string
  params: Record<string, any>
}

export interface GameResponse {
  success: boolean
  state: Partial<GameState>
  errors?: string[]
}
