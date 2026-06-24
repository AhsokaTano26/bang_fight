// ============================================================
// REST API controller for game management
// ============================================================

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { GameService } from './game.service'
import { GameStateService } from './game-state.service'
import { AiService } from './ai.service'
import { getCharacterDef } from './character-data'
import type { GameAction, GameState, PlayerState } from './types'

// ------------------------------------------------------------
// DTOs (simple inline types for request bodies)
// ------------------------------------------------------------

interface CreateGameDto {
  playerCount: number
  aiCount: number
}

interface ActionDto {
  type: string
  playerId: string
  params: Record<string, any>
}

interface AiTurnDto {
  playerId?: string // which AI player to act for
}

// ------------------------------------------------------------
// Controller
// ------------------------------------------------------------

@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly stateService: GameStateService,
    private readonly aiService: AiService,
  ) {}

  /**
   * POST /game/create
   * Create a new game.
   */
  @Post('create')
  createGame(@Body() body: CreateGameDto) {
    const { playerCount, aiCount } = body
    if (playerCount < 1 || aiCount < 1) {
      throw new HttpException(
        'Must have at least 1 human player and 1 AI player',
        HttpStatus.BAD_REQUEST,
      )
    }
    const state = this.gameService.createGame(playerCount, aiCount)
    return {
      success: true,
      gameId: state.gameId,
      state: this.sanitizeState(state),
    }
  }

  /**
   * GET /game/:id/state
   * Get the current state of a game.
   */
  @Get(':id/state')
  getState(@Param('id') id: string) {
    const state = this.stateService.get(id)
    if (!state) {
      throw new HttpException('Game not found', HttpStatus.NOT_FOUND)
    }
    return {
      success: true,
      state: this.sanitizeState(state),
    }
  }

  /**
   * POST /game/:id/action
   * Submit a player action.
   */
  @Post(':id/action')
  submitAction(@Param('id') id: string, @Body() body: ActionDto) {
    const state = this.stateService.get(id)
    if (!state) {
      throw new HttpException('Game not found', HttpStatus.NOT_FOUND)
    }
    if (state.gameOver) {
      throw new HttpException('Game is already over', HttpStatus.BAD_REQUEST)
    }

    const { type, playerId, params } = body

    let result: any

    switch (type) {
      case 'startTurn': {
        this.gameService.startTurn(state)
        this.gameService.drawPhase(state)
        result = { success: true, message: 'Turn started' }
        break
      }

      case 'deploy': {
        const { cardUid, position } = params
        result = this.gameService.deployCharacter(state, playerId, cardUid, position)
        break
      }

      case 'playCard': {
        const { cardUid, params: cardParams } = params
        result = this.gameService.playCard(state, playerId, cardUid, cardParams ?? {})
        break
      }

      case 'useSkill': {
        const { charUid, params: skillParams } = params
        result = this.gameService.useSkill(state, playerId, charUid, skillParams ?? {})
        break
      }

      case 'endTurn': {
        this.gameService.endTurn(state)
        // Auto-start next turn
        if (!state.gameOver) {
          this.gameService.startTurn(state)
          this.gameService.drawPhase(state)
        }
        result = { success: true, message: 'Turn ended' }
        break
      }

      case 'attack': {
        const { attackerCharUid, targetPlayerId, targetCharUid, armorPierce } = params
        result = this.gameService.playCard(state, playerId, params.cardUid ?? '', {
          attackerCharUid,
          targetPlayerId,
          targetCharUid,
          armorPierce,
        })
        break
      }

      case 'draw': {
        // Already handled by startTurn, but allow explicit draw
        this.gameService.drawPhase(state)
        result = { success: true, message: 'Drew cards' }
        break
      }

      default:
        throw new HttpException(`Unknown action type: ${type}`, HttpStatus.BAD_REQUEST)
    }

    return {
      ...result,
      state: this.sanitizeState(state),
    }
  }

  /**
   * POST /game/:id/ai-turn
   * Trigger a simple AI turn for single-player mode.
   */
  @Post(':id/ai-turn')
  aiTurn(@Param('id') id: string, @Body() body?: AiTurnDto) {
    const state = this.stateService.get(id)
    if (!state) {
      throw new HttpException('Game not found', HttpStatus.NOT_FOUND)
    }
    if (state.gameOver) {
      throw new HttpException('Game is already over', HttpStatus.BAD_REQUEST)
    }

    // Find the current AI player
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAi) {
      throw new HttpException('Current player is not an AI', HttpStatus.BAD_REQUEST)
    }

    // Use AI service
    this.aiService.executeTurn(state, currentPlayer)

    return {
      success: true,
      message: `AI turn completed for ${currentPlayer.name}`,
      state: this.sanitizeState(state),
    }
  }

  /**
   * Strip sensitive info before sending state to clients.
   */
  private sanitizeState(state: GameState): Partial<GameState> {
    return {
      gameId: state.gameId,
      players: state.players,
      currentPlayerIndex: state.currentPlayerIndex,
      turnNumber: state.turnNumber,
      turnPhase: state.turnPhase,
      characterPool: state.characterPool.map(() => ({ uid: '?', cardId: '?', suit: 'hearts' as any })),
      actionDeck: state.actionDeck.map(() => ({ uid: '?', cardId: '?', suit: 'hearts' as any })),
      strategyDeck: state.strategyDeck,
      pendingEffects: state.pendingEffects,
      battleLog: state.battleLog.slice(-20), // last 20 entries
      winner: state.winner,
      gameOver: state.gameOver,
    }
  }
}
