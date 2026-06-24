// ============================================================
// Game module -- bundles all game-related services and controllers
// ============================================================

import { Module } from '@nestjs/common'
import { DeckService } from './deck.service'
import { CombatService } from './combat.service'
import { GameStateService } from './game-state.service'
import { GameService } from './game.service'
import { AiService } from './ai.service'
import { DiceService } from './dice.service'
import { GameController } from './game.controller'

@Module({
  controllers: [GameController],
  providers: [DeckService, CombatService, GameStateService, GameService, AiService, DiceService],
  exports: [DeckService, CombatService, GameStateService, GameService, AiService, DiceService],
})
export class GameModule {}
