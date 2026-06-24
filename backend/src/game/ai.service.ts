// ============================================================
// Simple AI service for single-player mode
// ============================================================

import { Injectable } from '@nestjs/common'
import { GameService } from './game.service'
import { DeckService } from './deck.service'
import { getCharacterDef } from './character-data'
import type { GameState, PlayerState, CardInstance } from './types'

@Injectable()
export class AiService {
  constructor(
    private readonly gameService: GameService,
    private readonly deckService: DeckService,
  ) {}

  /**
   * Execute a simple AI turn.
   * Strategy:
   * 1. Deploy any character cards in hand to empty slots
   * 2. Attack the weakest enemy character with each character that has AP
   * 3. Use block/recovery cards if HP is low
   */
  executeTurn(state: GameState, aiPlayer: PlayerState): void {
    // Start turn
    this.gameService.startTurn(state)
    this.gameService.drawPhase(state)

    // 1. Deploy characters
    this.deployCharacters(state, aiPlayer)

    // 2. Attack with available characters
    this.attackEnemies(state, aiPlayer)

    // 3. Use recovery cards if needed
    this.useRecoveryIfNeeded(state, aiPlayer)

    // 4. End turn
    this.gameService.endTurn(state)
  }

  private deployCharacters(state: GameState, aiPlayer: PlayerState): void {
    const charCards = aiPlayer.hand.filter(
      (c) => getCharacterDef(c.cardId) !== undefined,
    )

    for (const card of charCards) {
      const emptySlot = aiPlayer.deployed.findIndex((s) => s.character === null)
      if (emptySlot === -1) break
      this.gameService.deployCharacter(state, aiPlayer.id, card.uid, emptySlot)
    }
  }

  private attackEnemies(state: GameState, aiPlayer: PlayerState): void {
    const enemyPlayers = state.players.filter(
      (p) => p.id !== aiPlayer.id && p.isAlive,
    )

    for (const slot of aiPlayer.deployed) {
      if (!slot.character || slot.character.state !== 'normal' || !slot.character.hasActionPoint) {
        continue
      }

      // Find target: prioritize character with lowest HP
      let bestTarget: { playerId: string; charUid: string } | null = null
      let lowestHp = Infinity

      for (const enemy of enemyPlayers) {
        for (const enemySlot of enemy.deployed) {
          if (enemySlot.character && enemySlot.character.state === 'normal') {
            if (enemySlot.character.currentHp < lowestHp) {
              lowestHp = enemySlot.character.currentHp
              bestTarget = { playerId: enemy.id, charUid: enemySlot.character.uid }
            }
          }
        }
      }

      if (bestTarget) {
        this.gameService.playCard(state, aiPlayer.id, '', {
          attackerCharUid: slot.character.uid,
          targetPlayerId: bestTarget.playerId,
          targetCharUid: bestTarget.charUid,
          armorPierce: false,
        })
      }
    }
  }

  private useRecoveryIfNeeded(state: GameState, aiPlayer: PlayerState): void {
    // Check if any character is near-death
    const hasNearDeath = aiPlayer.deployed.some(
      (s) => s.character?.state === 'nearDeath',
    )

    if (hasNearDeath) {
      // Try to find a recovery card
      const recoveryCard = aiPlayer.hand.find((c) => {
        const def = this.deckService.actionCardDefs.find((d) => d.id === c.cardId)
        return def && (def.actionType === 'recovery' || def.actionType === 'bigRecovery')
      })

      if (recoveryCard) {
        // Find near-death character
        const targetSlot = aiPlayer.deployed.find(
          (s) => s.character?.state === 'nearDeath',
        )
        if (targetSlot?.character) {
          this.gameService.playCard(state, aiPlayer.id, recoveryCard.uid, {
            targetCharUid: targetSlot.character.uid,
          })
        }
      }
    }
  }
}
