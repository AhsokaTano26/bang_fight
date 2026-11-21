// ============================================================
// Shared utilities for strategy card handlers
// ============================================================

import { getCharacterDef } from '../character-data'
import type {
  BattleLogEntry,
  CardInstance,
  DeployedCharacter,
  GameState,
  PlayerState,
  StrategyCardDef,
  TurnPhase,
} from '../types'

// ------------------------------------------------------------
// Context passed to every strategy handler
// ------------------------------------------------------------

export interface StrategyContext {
  state: GameState
  player: PlayerState
  card: CardInstance
  def: StrategyCardDef
  targetPlayerId?: string
  targetCharUid?: string
  params: Record<string, any>
}

export interface StrategyResult {
  success: boolean
  message: string
  skipDiscard?: boolean
}

export type StrategyHandler = (ctx: StrategyContext) => StrategyResult

// ------------------------------------------------------------
// Player / character lookups
// ------------------------------------------------------------

export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId)
}

export function findDeployedChar(
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

export function getCharName(char: DeployedCharacter): string {
  return getCharacterDef(char.cardId)?.name ?? char.cardId
}

export function getEnemyPlayers(state: GameState, playerId: string): PlayerState[] {
  return state.players.filter((p) => p.id !== playerId && p.isAlive)
}

// ------------------------------------------------------------
// Random helpers
// ------------------------------------------------------------

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ------------------------------------------------------------
// Logging
// ------------------------------------------------------------

function now(): number {
  return Date.now()
}

export function addLog(
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
