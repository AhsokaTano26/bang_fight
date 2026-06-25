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
import { CombatService } from './combat.service'
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
    private readonly combatService: CombatService,
    private readonly aiService: AiService,
  ) {}

  /**
   * POST /game/create
   * Create a new game.
   */
  @Post('create')
  createGame(@Body() body: CreateGameDto) {
    const { playerCount, aiCount } = body
    if (aiCount < 1) {
      throw new HttpException(
        '至少需要1名AI玩家',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (playerCount < 0) {
      throw new HttpException(
        '玩家数量不能为负数',
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
      throw new HttpException('未找到游戏', HttpStatus.NOT_FOUND)
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
      throw new HttpException('未找到游戏', HttpStatus.NOT_FOUND)
    }
    if (state.gameOver) {
      throw new HttpException('游戏已经结束', HttpStatus.BAD_REQUEST)
    }

    const { type, playerId, params } = body

    let result: any

    switch (type) {
      case 'startTurn': {
        this.gameService.startTurn(state)
        result = { success: true, message: '回合开始' }
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

      case 'useEquipment': {
        const { charUid: eqCharUid, params: eqParams } = params
        result = this.gameService.useEquipment(state, playerId, eqCharUid, eqParams ?? {})
        break
      }

      case 'endTurn': {
        this.gameService.endTurn(state)
        result = { success: true, message: '回合结束' }
        break
      }

      case 'attack': {
        const { attackerCharUid, targetPlayerId, targetCharUid, armorPierce } = params
        result = this.combatService.resolveAttack(
          state,
          playerId,
          attackerCharUid,
          targetPlayerId,
          targetCharUid,
          armorPierce ?? false,
        )
        break
      }

      case 'directAttack': {
        const { attackerCharUid, targetPlayerId } = params
        result = this.combatService.resolveDirectAttack(
          state,
          playerId,
          attackerCharUid,
          targetPlayerId,
        )
        break
      }

      case 'replaceCharacter': {
        const { deployedUid, handCardUid } = params
        result = this.gameService.replaceCharacter(state, playerId, deployedUid, handCardUid)
        break
      }

      case 'draw': {
        // Already handled by startTurn, but allow explicit draw
        this.gameService.drawPhase(state)
        result = { success: true, message: '摸牌成功' }
        break
      }

      default:
        throw new HttpException(`未知操作类型: ${type}`, HttpStatus.BAD_REQUEST)
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
      throw new HttpException('未找到游戏', HttpStatus.NOT_FOUND)
    }
    if (state.gameOver) {
      throw new HttpException('游戏已经结束', HttpStatus.BAD_REQUEST)
    }

    // Find the current AI player
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAi) {
      throw new HttpException('当前玩家不是AI', HttpStatus.BAD_REQUEST)
    }

    // Start AI's turn (refresh AP, draw cards, set phase to 'action')
    this.gameService.startTurn(state)
    this.gameService.drawPhase(state)

    // Use AI service
    this.aiService.executeTurn(state, currentPlayer)

    // End AI's turn (advance to next player)
    this.gameService.endTurn(state)

    return {
      success: true,
      message: `${currentPlayer.name}的AI回合已完成`,
      state: this.sanitizeState(state),
    }
  }

  /**
   * Strip sensitive info before sending state to clients.
   * Hides enemy hand cards (only shows count).
   */
  private sanitizeState(state: GameState): Partial<GameState> {
    return {
      gameId: state.gameId,
      players: state.players.map(p => ({
        ...p,
        // Hide AI hands — only reveal card count
        hand: p.isAi ? p.hand.map(() => ({ uid: '?', cardId: '?', suit: 'hearts' as any })) : p.hand,
      })),
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
