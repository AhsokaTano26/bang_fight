import { Injectable } from '@nestjs/common'
import { GameService } from './game.service'
import { DeckService } from './deck.service'
import { CombatService } from './combat.service'
import { canTakeTurn, observe } from './ai/observation'
import { actionKey, rankActions } from './ai/scoring'
import type { AiAction, TurnReport } from './ai/types'
import type { GameState, PlayerState } from './types'

/** Pure utility selection; mutations go through the same rules as human actions. */
@Injectable()
export class AiService {
  constructor(
    private readonly gameService: GameService,
    private readonly deckService: DeckService,
    private readonly combatService: CombatService,
  ) {}

  executeTurn(state: GameState, aiPlayer: PlayerState): TurnReport {
    const report: TurnReport = { attempts: 0, successes: 0, stopped: 'no-action', decisions: [] }
    const rejected = new Set<string>()
    const catalog = {
      actions: this.deckService.actionCardDefs,
      strategies: this.deckService.strategyCardDefs,
    }
    // The attempt budget includes successful resource cycles and failed/no-op actions.
    while (report.attempts < 64) {
      const view = observe(state, aiPlayer.id)
      if (!view || !canTakeTurn(view)) {
        report.stopped = state.gameOver ? 'game-over' : 'invalid-turn'
        return report
      }
      const before = JSON.stringify(view)
      const decision = rankActions(view, catalog).find(
        (d) => !rejected.has(`${before}:${actionKey(d.action)}`),
      )
      if (!decision) return report
      const result = this.execute(state, aiPlayer.id, decision.action)
      report.attempts++
      report.decisions.push({ ...decision, ...result })
      if (result.success) {
        report.successes++
        this.gameService.checkGameOver(state)
        if (state.gameOver) {
          report.stopped = 'game-over'
          return report
        }
      }
      const after = observe(state, aiPlayer.id)
      if (!result.success || JSON.stringify(after) === before)
        rejected.add(`${before}:${actionKey(decision.action)}`)
    }
    report.stopped = 'budget'
    return report
  }

  private execute(
    state: GameState,
    playerId: string,
    action: AiAction,
  ): { success: boolean; message: string } {
    switch (action.type) {
      case 'deploy':
        return this.gameService.deployCharacter(state, playerId, action.cardUid, action.position)
      case 'replace':
        return this.gameService.replaceCharacter(state, playerId, action.charUid, action.cardUid)
      case 'playCard':
        return this.gameService.playCard(state, playerId, action.cardUid, action.params)
      case 'useSkill':
        return this.gameService.useSkill(state, playerId, action.charUid, action.params)
      case 'useEquipment':
        return this.gameService.useEquipment(state, playerId, action.charUid, {})
      case 'attack':
        return this.gameService.attack(
          state,
          playerId,
          action.charUid,
          action.targetPlayerId,
          action.targetCharUid,
          action.armorPierce,
        )
      case 'directAttack':
        return this.gameService.directAttack(state, playerId, action.charUid, action.targetPlayerId)
    }
  }
}
