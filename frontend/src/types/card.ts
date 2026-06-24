// ============================================================
// Card type definitions for 邦邦武斗传 (Bang Bang Fight)
// ============================================================

/** 卡牌大类 */
export type CardCategory = 'character' | 'action' | 'strategy' | 'auxiliary'

/** 阵营 */
export type Faction = 'AG' | 'HHW' | 'PAS' | 'PPP' | 'ROS'

/** 行动牌类型 */
export type ActionCardType =
  | 'attack'       // 攻击 (肘) - 普通攻击
  | 'armorPierce'  // 破甲攻击 (破) - 无视护甲
  | 'bigBlock'     // 防御 (防 All) - 大格挡，全体
  | 'smallBlock'   // 格挡 (挡) - 小格挡，单体
  | 'recovery'     // 回复 (mini) - 小回复
  | 'bigRecovery'  // 回复大 - 大回复
  | 'replenish'    // 补充 - 摸牌或补充角色

/** 策略牌子类型 */
export type StrategySubType = 'deployable' | 'instant'

/** 角色状态 */
export type CharacterState = 'normal' | 'nearDeath' | 'retired'

/** 花色 (用于判定) */
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

// ============================================================
// Base card interface
// ============================================================

export interface BaseCard {
  id: string              // 唯一ID, e.g. "AG1001", "ATK_1"
  name: string            // 卡牌名称
  category: CardCategory  // 卡牌大类
  imageFile: string       // 图片文件名 (相对于 public/cards/)
  description?: string    // 卡牌描述文字
  suit?: Suit             // 花色 (行动牌/策略牌)
}

// ============================================================
// Character card (角色牌)
// ============================================================

export interface CharacterCard extends BaseCard {
  category: 'character'
  faction: Faction        // 所属阵营
  maxHp: number           // 最大血量 (1-5)
  attack: number          // 基础攻击力 (1-5)
  skills: CharacterSkill[] // 角色技能
}

export interface CharacterSkill {
  name: string            // 技能名称, e.g. "一直摸兜里"
  description: string     // 技能描述
  consumeActionPoint: boolean  // 是否消耗行动点
  effect: SkillEffect     // 技能效果定义
}

export interface SkillEffect {
  type: string            // 效果类型标识
  params: Record<string, any> // 效果参数
}

// ============================================================
// Action card (行动牌)
// ============================================================

export interface ActionCard extends BaseCard {
  category: 'action'
  actionType: ActionCardType
  requiresTarget: boolean // 是否需要选择目标
  affectsAll: boolean     // 是否影响所有角色 (大格挡/大回复)
  armorPierce?: boolean   // 是否无视护甲
}

// ============================================================
// Strategy card (策略牌)
// ============================================================

export interface StrategyCard extends BaseCard {
  category: 'strategy'
  strategyType: StrategySubType  // 道具牌 or 即时牌
  deployable?: boolean    // 是否可部署 (道具牌)
  instant?: boolean       // 是否即时触发
  requiresTarget: boolean
}

// ============================================================
// Auxiliary card (辅助牌)
// ============================================================

export interface AuxiliaryCard extends BaseCard {
  category: 'auxiliary'
}

// ============================================================
// Union type
// ============================================================

export type Card = CharacterCard | ActionCard | StrategyCard | AuxiliaryCard

// ============================================================
// Card instance (一张具体的卡牌实例，带运行时状态)
// ============================================================

export interface CardInstance {
  uid: string             // 运行时唯一ID (每局游戏生成)
  cardId: string          // 对应的 Card.id
  suit: Suit              // 每张卡实例有独立花色
}
