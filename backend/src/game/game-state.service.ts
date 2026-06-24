// ============================================================
// In-memory game state storage
// ============================================================

import { Injectable } from '@nestjs/common'
import type { GameState } from './types'

@Injectable()
export class GameStateService {
  /** Active games keyed by gameId. */
  private readonly games = new Map<string, GameState>()

  create(gameId: string, state: GameState): void {
    this.games.set(gameId, state)
  }

  get(gameId: string): GameState | undefined {
    return this.games.get(gameId)
  }

  getAll(): GameState[] {
    return Array.from(this.games.values())
  }

  delete(gameId: string): boolean {
    return this.games.delete(gameId)
  }

  has(gameId: string): boolean {
    return this.games.has(gameId)
  }
}
