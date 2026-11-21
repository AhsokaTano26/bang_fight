import type { GameState } from '../types'
import type { Observation } from './types'

/** The decision core never receives enemy hands or either hidden deck. */
export function observe(state: GameState, playerId: string): Observation | null {
  const own = state.players.find((p) => p.id === playerId)
  if (!own) return null
  return {
    own: structuredClone(own),
    enemies: state.players
      .filter((p) => p.id !== playerId && p.isAlive)
      .map((p) => ({
        id: p.id,
        hp: p.hp,
        maxHp: p.maxHp,
        handCount: p.hand.length,
        deployed: structuredClone(p.deployed),
        discardPile: structuredClone(p.discardPile),
        graveyard: structuredClone(p.graveyard),
        judgmentZone: structuredClone(p.judgmentZone),
      })),
    currentPlayerId: state.players[state.currentPlayerIndex]?.id ?? '',
    phase: state.turnPhase,
    gameOver: state.gameOver,
    actionDeckCount: state.actionDeck.length,
    characterPoolCount: state.characterPool.length,
  }
}

export function canTakeTurn(view: Observation): boolean {
  return (
    !view.gameOver &&
    view.own.isAlive &&
    view.phase === 'action' &&
    view.currentPlayerId === view.own.id &&
    !view.own.deployed.some((s) => s.character?.debuffs.some((d) => d.type === 'skipAction'))
  )
}
