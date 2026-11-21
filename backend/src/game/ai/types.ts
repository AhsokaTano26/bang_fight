import type {
  ActionCardDef,
  CardInstance,
  DeployedSlot,
  PlayerState,
  StrategyCardDef,
  TurnPhase,
} from '../types'

export interface PublicPlayer {
  id: string
  hp: number
  maxHp: number
  handCount: number
  deployed: DeployedSlot[]
  discardPile: CardInstance[]
  graveyard: CardInstance[]
  judgmentZone: CardInstance[]
}

export interface Observation {
  own: PlayerState
  enemies: PublicPlayer[]
  currentPlayerId: string
  phase: TurnPhase
  gameOver: boolean
  actionDeckCount: number
  characterPoolCount: number
}

export interface Catalog {
  actions: readonly ActionCardDef[]
  strategies: readonly StrategyCardDef[]
}

export type ActionParams = Record<string, string | number | boolean>
export type AiAction =
  | { type: 'deploy'; cardUid: string; position: number }
  | { type: 'replace'; cardUid: string; charUid: string }
  | {
      type: 'attack'
      charUid: string
      targetPlayerId: string
      targetCharUid: string
      armorPierce: boolean
    }
  | { type: 'directAttack'; charUid: string; targetPlayerId: string }
  | { type: 'playCard'; cardUid: string; params: ActionParams }
  | { type: 'useSkill'; charUid: string; params: ActionParams }
  | { type: 'useEquipment'; charUid: string }

export interface Decision {
  action: AiAction
  utility: number
}

export interface TurnReport {
  attempts: number
  successes: number
  stopped: 'no-action' | 'budget' | 'game-over' | 'invalid-turn'
  decisions: (Decision & { success: boolean; message: string })[]
}
