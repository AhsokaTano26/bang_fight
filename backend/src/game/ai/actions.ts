import { getCharacterDef } from '../character-data'
import type { CardInstance } from '../types'
import { canAttack, canUseAp } from './combat-model'
import { canTakeTurn } from './observation'
import type { ActionParams, AiAction, Catalog, Observation } from './types'

/** Enumerate only implemented actions with sufficient public targeting information. */
export function enumerateActions(view: Observation, catalog: Catalog): AiAction[] {
  if (!canTakeTurn(view)) return []
  const { own, enemies } = view
  const result: AiAction[] = []
  const allies = own.deployed.flatMap((s) => (s.character ? [s.character] : []))
  const active = allies.filter((c) => c.state === 'normal')
  const emptySlots = own.deployed.filter((s) => !s.character).map((s) => s.position)
  const play = (card: CardInstance, params: ActionParams = {}) =>
    result.push({ type: 'playCard', cardUid: card.uid, params })
  const enemyTargets = enemies.flatMap((p) =>
    p.deployed.flatMap((s) =>
      s.character && s.character.state !== 'retired'
        ? [{ player: p, slot: s, char: s.character }]
        : [],
    ),
  )
  const attackTargets = enemyTargets.filter((t) => !t.char.keywords.includes('untargetable'))

  for (const char of active) {
    if (canAttack(char)) {
      for (const target of attackTargets)
        result.push({
          type: 'attack',
          charUid: char.uid,
          targetPlayerId: target.player.id,
          targetCharUid: target.char.uid,
          armorPierce: char.keywords.includes('armorPierce'),
        })
      for (const enemy of enemies.filter(
        (p) => !p.deployed.some((s) => s.character && s.character.state !== 'retired'),
      )) {
        result.push({ type: 'directAttack', charUid: char.uid, targetPlayerId: enemy.id })
      }
    }

    if (canUseAp(char)) {
      const condition = char.buffs.find((b) => b.type === 'conditionalBonus')?.source.split(':')[1]
      const slot = own.deployed.find((s) => s.character?.uid === char.uid)!
      if (
        slot.equipment &&
        view.actionDeckCount > 0 &&
        ['scry5pick2', 'discardToDraw'].includes(condition ?? '')
      ) {
        result.push({ type: 'useEquipment', charUid: char.uid })
      }
    }

    const skill = getCharacterDef(char.cardId)?.skills[0]
    if (
      !skill ||
      char.silenced ||
      char.debuffs.some((d) => d.type === 'loseAbility') ||
      (skill.consumeActionPoint && !char.hasActionPoint)
    )
      continue
    const use = (params: ActionParams = {}) =>
      result.push({ type: 'useSkill', charUid: char.uid, params })
    switch (skill.effect.type) {
      case 'stealCard':
        if (enemies.some((p) => p.handCount > 0)) use()
        break
      case 'summon':
        if (emptySlots.length) use()
        break
      case 'buffAlly':
        for (const target of active.filter((c) => c.uid !== char.uid))
          use({ targetCharUid: target.uid })
        break
      case 'sacrificeHealAlly':
        for (const target of allies.filter((c) => c.uid !== char.uid && c.state === 'nearDeath'))
          use({ targetCharUid: target.uid })
        break
      case 'restoreAllyAP':
        if (own.hand.length)
          for (const target of active.filter((c) => !c.hasActionPoint))
            use({ targetCharUid: target.uid })
        break
      case 'sacrificeForPower':
        if (own.hand.length) use()
        break
      case 'transferDebuff':
        if (active.some((c) => c.uid !== char.uid && c.debuffs.length)) use()
        break
      case 'scryDraw':
        if (view.actionDeckCount > 0) use()
        break
      case 'stealDiscard':
        if (
          !char.buffs.some((b) => b.type === 'stealDiscard' && b.remainingTurns !== 0) &&
          enemies.some((p) => p.handCount)
        )
          use()
        break
      // Passive, incomplete and unconsumed marker effects deliberately have no candidates.
    }
  }

  for (const card of own.hand) {
    const character = getCharacterDef(card.cardId)
    if (character) {
      for (const position of emptySlots)
        result.push({ type: 'deploy', cardUid: card.uid, position })
      if (!emptySlots.length && own.replacementCountThisTurn < 1) {
        for (const target of allies)
          result.push({ type: 'replace', cardUid: card.uid, charUid: target.uid })
      }
      continue
    }
    const action = catalog.actions.find((d) => d.id === card.cardId)
    if (action) {
      switch (action.actionType) {
        case 'attack':
        case 'armorPierce':
          for (const actor of active.filter(canAttack))
            for (const target of attackTargets)
              play(card, {
                attackerCharUid: actor.uid,
                targetPlayerId: target.player.id,
                targetCharUid: target.char.uid,
              })
          for (const actor of active.filter(canAttack))
            for (const enemy of enemies.filter(
              (p) => !p.deployed.some((s) => s.character && s.character.state !== 'retired'),
            )) {
              play(card, { attackerCharUid: actor.uid, targetPlayerId: enemy.id })
            }
          break
        case 'bigBlock':
          if (active.some(canUseAp)) play(card)
          break
        case 'smallBlock':
          if (active.some(canUseAp))
            for (const target of active) play(card, { targetCharUid: target.uid })
          break
        case 'recovery':
          for (const target of allies.filter((c) => c.state !== 'retired'))
            play(card, { targetCharUid: target.uid })
          if (own.hp < own.maxHp) play(card, { targetType: 'player' })
          break
        case 'bigRecovery':
          if (allies.length) play(card)
          if (own.hp < own.maxHp) play(card, { targetType: 'player' })
          break
        case 'replenish':
          if (
            view.actionDeckCount ||
            own.discardPile.length ||
            enemies.some((p) => p.discardPile.length)
          )
            play(card)
          if (emptySlots.length && view.characterPoolCount && own.hp > 3)
            play(card, { mode: 'recruit' })
          break
      }
      continue
    }
    const strategy = catalog.strategies.find((d) => d.id === card.cardId)
    if (!strategy) continue
    if (strategy.strategyType === 'deployable') {
      for (const slot of own.deployed.filter(
        (s) => s.character?.state === 'normal' && !s.equipment,
      )) {
        play(card, { targetCharUid: slot.character!.uid })
      }
      continue
    }
    switch (strategy.instantType) {
      case 'drawWithBonus':
      case 'suitJudgmentDraw':
        if (
          view.actionDeckCount ||
          own.discardPile.length ||
          enemies.some((p) => p.discardPile.length)
        )
          play(card)
        break
      case 'drawAndRemoveEvil':
      case 'slotMachine':
      case 'allPlayersDraw':
        if (view.actionDeckCount) play(card)
        break
      case 'removeDebuff':
        for (const target of allies.filter((c) => c.debuffs.length || c.silenced))
          play(card, { targetCharUid: target.uid })
        break
      case 'grantCrit':
      case 'grantTempArmorPierce':
        for (const target of active.filter(canAttack)) play(card, { targetCharUid: target.uid })
        break
      case 'unlimitedApThisTurn':
        if (active.some((c) => !c.hasActionPoint)) play(card)
        break
      case 'summonFromGraveyard':
        if (emptySlots.length)
          for (const target of own.graveyard.filter((c) => getCharacterDef(c.cardId)))
            play(card, { targetCardUid: target.uid })
        break
      case 'drawCharAndDeploy':
        if (emptySlots.length && view.characterPoolCount) play(card)
        break
      case 'retrieveFromDiscard':
        for (const target of own.discardPile) play(card, { targetCardUid: target.uid })
        break
      case 'retrieveInstantFromDiscard':
        if (
          own.discardPile.some((c) =>
            catalog.strategies.some((d) => d.id === c.cardId && d.strategyType === 'instant'),
          )
        )
          play(card)
        break
      case 'removeJudgment':
        if (own.judgmentZone.length) play(card, { targetPlayerId: own.id })
        break
      case 'protectNearDeath':
        for (const target of allies.filter((c) => c.state === 'nearDeath'))
          play(card, { targetCharUid: target.uid })
        break
      case 'stealEquipment':
        for (const target of enemyTargets.filter((t) => t.slot.equipment))
          play(card, { targetPlayerId: target.player.id, targetCharUid: target.char.uid })
        break
      case 'discardUndeployedChar':
        for (const enemy of enemies.filter((p) => p.handCount > 0))
          play(card, { targetPlayerId: enemy.id })
        break
      case 'weakenTwoTargets':
        for (let i = 0; i < enemyTargets.length; i++) {
          for (let j = i + 1; j < enemyTargets.length; j++)
            play(card, {
              targetCharUid1: enemyTargets[i].char.uid,
              targetCharUid2: enemyTargets[j].char.uid,
            })
        }
        break
      case 'feverEffect': {
        const factions = active.map((c) => getCharacterDef(c.cardId)?.faction)
        if (factions.length === 5 && factions[0] && factions.every((f) => f === factions[0]))
          play(card)
        break
      }
      // Uncertain exchanges/duels and effects without consumers are withheld.
    }
  }
  return result
}
