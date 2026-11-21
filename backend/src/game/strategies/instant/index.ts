// ============================================================
// Instant strategy card dispatch table
// Maps instantType → handler function
// ============================================================

import type { StrategyHandler, StrategyResult } from '../utils'
import { disarmEquipment } from './disarmEquipment'
import { discardUndeployedChar } from './discardUndeployedChar'
import { duelMode } from './duelMode'
import { counterInstant } from './counterInstant'
import { stealEquipment } from './stealEquipment'
import { placeJudgment } from './placeJudgment'
import { grantTempArmorPierce } from './grantTempArmorPierce'
import { russianRoulette } from './russianRoulette'
import { suitJudgmentDraw } from './suitJudgmentDraw'
import { placeJudgmentPass } from './placeJudgmentPass'
import { retrieveInstantFromDiscard } from './retrieveInstantFromDiscard'
import { drawCharAndDeploy } from './drawCharAndDeploy'
import { removeJudgment } from './removeJudgment'
import { summonFromGraveyard } from './summonFromGraveyard'
import { grantCrit } from './grantCrit'
import { unlimitedApThisTurn } from './unlimitedApThisTurn'
import { swapHandWithPlayers } from './swapHandWithPlayers'
import { swapPositions } from './swapPositions'
import { silenceTarget } from './silenceTarget'
import { viewHand } from './viewHand'
import { slotMachine } from './slotMachine'
import { allPlayersDraw } from './allPlayersDraw'
import { protectNearDeath } from './protectNearDeath'
import { chanceIgnoreSkill } from './chanceIgnoreSkill'
import { weakenTwoTargets } from './weakenTwoTargets'
import { feverEffect } from './feverEffect'
import { retrieveFromDiscard } from './retrieveFromDiscard'
import { forceEarthStore } from './forceEarthStore'
import { drawAndRemoveEvil } from './drawAndRemoveEvil'
import { removeDebuff } from './removeDebuff'
import { disableFactionSkill } from './disableFactionSkill'
import { counterSkill } from './counterSkill'
import { maintainFactionSkill } from './maintainFactionSkill'
import { drawWithBonus } from './drawWithBonus'

// ------------------------------------------------------------
// Dispatch table
// ------------------------------------------------------------

const handlers: Record<string, StrategyHandler> = {
  disarmEquipment,
  discardUndeployedChar,
  duelMode,
  counterInstant,
  stealEquipment,
  placeJudgment,
  grantTempArmorPierce,
  russianRoulette,
  suitJudgmentDraw,
  placeJudgmentPass,
  retrieveInstantFromDiscard,
  drawCharAndDeploy,
  removeJudgment,
  summonFromGraveyard,
  grantCrit,
  unlimitedApThisTurn,
  swapHandWithPlayers,
  swapPositions,
  silenceTarget,
  viewHand,
  slotMachine,
  allPlayersDraw,
  protectNearDeath,
  chanceIgnoreSkill,
  weakenTwoTargets,
  feverEffect,
  retrieveFromDiscard,
  forceEarthStore,
  drawAndRemoveEvil,
  removeDebuff,
  disableFactionSkill,
  counterSkill,
  maintainFactionSkill,
  drawWithBonus,
}

export function executeInstantStrategy(
  instantType: string,
  ctx: Parameters<StrategyHandler>[0],
): StrategyResult {
  const handler = handlers[instantType]
  if (!handler) {
    return { success: false, message: `未实现的即时效果: ${instantType}` }
  }
  return handler(ctx)
}
