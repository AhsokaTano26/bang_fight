import { CHARACTER_CARDS, getCharacterDef } from '../character-data'
import type { CardInstance, DeployedCharacter, DeployedSlot } from '../types'
import { enumerateActions } from './actions'
import { attackOutcomes, attackPower, canAttack, canUseAp, redirectedTarget } from './combat-model'
import type { AiAction, Catalog, Decision, Observation, PublicPlayer } from './types'

// HP equivalents: a retained card = one HP; attack = one future-turn contribution.
// These are tunable heuristics, never a claim of optimal play.
const CARD_VALUE = 1
const liveChars = (player: { deployed: DeployedSlot[] }) =>
  player.deployed.flatMap((s) =>
    s.character && s.character.state !== 'retired' ? [s.character] : [],
  )
const ownChar = (view: Observation, uid: string) => liveChars(view.own).find((c) => c.uid === uid)
const boardValue = (char: DeployedCharacter) => Math.max(0, char.currentHp) + attackPower(char)
const cardCost = (view: Observation) =>
  view.own.hand.filter((c) => !getCharacterDef(c.cardId)).length > 5 ? 0 : CARD_VALUE

function terminalValue(view: Observation): number {
  return (
    view.own.hp +
    liveChars(view.own).reduce((n, c) => n + boardValue(c), 0) +
    view.enemies.reduce(
      (n, p) => n + p.hp + liveChars(p).reduce((sum, c) => sum + boardValue(c), 0),
      0,
    ) +
    view.own.hand.length +
    1
  )
}

export function attackUtility(
  view: Observation,
  attacker: DeployedCharacter,
  enemy: PublicPlayer,
  targetUid?: string,
  pierce = false,
): number {
  if (!canAttack(attacker)) return 0
  if (!targetUid) {
    if (liveChars(enemy).length) return 0
    // Current direct resolution applies boosts, but not weaken or critical hits.
    const damage = Math.max(
      0,
      attacker.attack +
        attacker.buffs.filter((b) => b.type === 'attackBoost').reduce((n, b) => n + b.value, 0),
    )
    return Math.min(enemy.hp, damage) + (damage >= enemy.hp ? terminalValue(view) : 0)
  }
  const selected = enemy.deployed.find((s) => s.character?.uid === targetUid)?.character
  if (!selected || selected.keywords.includes('untargetable')) return 0
  const targetInfo = redirectedTarget(
    enemy.deployed,
    targetUid,
    pierce,
    attacker.keywords.includes('ignoreGuardian'),
  )
  if (!targetInfo) return 0
  const target = targetInfo.char
  return attackOutcomes(attacker, target, pierce).reduce((score, outcome) => {
    // Discount armor attrition by the number of additional hits needed to reach HP.
    const armorValue =
      outcome.armorDamage / (1 + Math.ceil(target.armor / Math.max(1, attackPower(attacker))))
    // A single block delays HP damage by one additional hit, hence a two-hit horizon.
    let value =
      outcome.damage +
      armorValue +
      outcome.blockDamage / 2 +
      (outcome.retired ? attackPower(target) : 0)
    if (outcome.retired && liveChars(enemy).length === 1 && enemy.handCount === 0)
      value += terminalValue(view)
    if (attacker.keywords.includes('spread') && outcome.spreadDamage > 0) {
      for (const index of [targetInfo.slotIndex - 1, targetInfo.slotIndex + 1]) {
        const adjacent = enemy.deployed[index]?.character
        if (
          adjacent?.state === 'normal' &&
          !adjacent.keywords.includes('immunity') &&
          !adjacent.buffs.some((b) => b.type === 'block' && b.value > 0)
        )
          value += Math.min(adjacent.currentHp, outcome.spreadDamage)
      }
    }
    let counterCost = Math.min(1, attacker.currentHp)
    if (attacker.currentHp <= 1) {
      counterCost += attackPower(attacker)
      if (liveChars(view.own).length === 1 && !view.own.hand.some((c) => getCharacterDef(c.cardId)))
        counterCost += terminalValue(view)
    }
    return score + outcome.probability * (value - outcome.counterProbability * counterCost)
  }, 0)
}

function bestAttack(view: Observation, char: DeployedCharacter): number {
  if (!canAttack(char)) return 0
  return Math.max(
    0,
    ...view.enemies.flatMap((enemy) =>
      liveChars(enemy).length
        ? liveChars(enemy).map((target) =>
            attackUtility(view, char, enemy, target.uid, char.keywords.includes('armorPierce')),
          )
        : [attackUtility(view, char, enemy)],
    ),
  )
}

function healValue(view: Observation, char: DeployedCharacter): number {
  const after = {
    ...char,
    currentHp: getCharacterDef(char.cardId)?.maxHp ?? char.maxHp,
    state: 'normal' as const,
    hasActionPoint: true,
  }
  return (
    after.currentHp - char.currentHp + Math.max(0, bestAttack(view, after) - bestAttack(view, char))
  )
}

function drawValue(view: Observation, count: number): number {
  const nonCharacters = view.own.hand.filter((c) => !getCharacterDef(c.cardId)).length
  return Math.min(count, Math.max(0, 6 - nonCharacters)) * CARD_VALUE
}

function incomingDamage(view: Observation, target: DeployedCharacter): number {
  return Math.max(
    0,
    ...view.enemies.flatMap((enemy) =>
      liveChars(enemy).map((actor) => {
        const ready = { ...actor, state: 'normal' as const, hasActionPoint: true }
        if (!canAttack(ready)) return 0
        const redirected = redirectedTarget(
          view.own.deployed,
          target.uid,
          actor.keywords.includes('armorPierce'),
          actor.keywords.includes('ignoreGuardian'),
        )
        if (redirected?.char.uid !== target.uid) return 0
        return attackOutcomes(ready, target, actor.keywords.includes('armorPierce')).reduce(
          (n, o) => n + o.probability * o.damage,
          0,
        )
      }),
    ),
  )
}

function equipmentValue(
  view: Observation,
  catalog: Catalog,
  card: CardInstance,
  char: DeployedCharacter,
): number {
  const def = catalog.strategies.find((d) => d.id === card.cardId)
  const after = structuredClone(char)
  let value = 0
  for (const effect of def?.equipEffects ?? []) {
    switch (effect.type) {
      case 'attackBoost':
        after.attack += effect.value ?? 0
        value += effect.value ?? 0
        break
      case 'hpBoost':
        after.currentHp += effect.value ?? 0
        after.maxHp += effect.value ?? 0
        value += effect.value ?? 0
        break
      case 'armorBoost':
        after.armor += effect.value ?? 0
        value += Math.min(effect.value ?? 0, incomingDamage(view, char))
        break
      case 'grantKeyword':
        if (effect.keyword && !after.keywords.includes(effect.keyword))
          after.keywords.push(effect.keyword)
        break
      case 'armorPierceOnAttack':
        after.buffs.push({
          type: 'armorPierceOnAttack',
          value: 1,
          remainingTurns: -1,
          source: card.uid,
        })
        break
      case 'critOnAttack':
        after.buffs.push({ type: 'critOnAttack', value: 1, remainingTurns: -1, source: card.uid })
        break
      case 'forceRetireOnHit':
        after.buffs.push({
          type: 'forceRetireOnHit',
          value: 1,
          remainingTurns: -1,
          source: card.uid,
        })
        break
      case 'ignoreGuardian':
        after.keywords.push('ignoreGuardian')
        break
      case 'unTargetable':
        after.keywords.push('untargetable')
        value += incomingDamage(view, char)
        break
      case 'nearDeathRecover':
        value += incomingDamage(view, char)
        break
      case 'conditionalBonus':
        if (effect.condition === 'scry5pick2' && view.actionDeckCount)
          value += drawValue(view, Math.min(2, view.actionDeckCount))
        break
      // Unconsumed conditional, hand-limit and defensive markers earn no utility.
    }
  }
  if (after.currentHp <= 0) return -boardValue(char)
  return value + bestAttack(view, after) - bestAttack(view, char)
}

function retrievedValue(view: Observation, catalog: Catalog, card?: CardInstance): number {
  if (!card) return 0
  const def = getCharacterDef(card.cardId)
  if (def) return view.own.deployed.some((s) => !s.character) ? def.maxHp + def.attack : 0
  const action = catalog.actions.find((d) => d.id === card.cardId)
  if (action?.actionType === 'bigRecovery')
    return liveChars(view.own).reduce((n, c) => n + Math.max(0, healValue(view, c)), 0) - CARD_VALUE
  if (action?.actionType === 'recovery')
    return Math.max(0, ...liveChars(view.own).map((c) => healValue(view, c))) - CARD_VALUE
  const strategy = catalog.strategies.find((d) => d.id === card.cardId)
  if (strategy?.instantType === 'drawWithBonus')
    return drawValue(view, Math.min(2, view.actionDeckCount)) - CARD_VALUE
  if (strategy?.strategyType === 'deployable')
    return (
      Math.max(
        0,
        ...view.own.deployed
          .filter((s) => s.character && !s.equipment)
          .map((s) => equipmentValue(view, catalog, card, s.character!)),
      ) - CARD_VALUE
    )
  return 0 // Retrieval cycles receive no speculative utility.
}

/** Uniform prior over unknown card locations; all inputs are public counts/cards. */
function hiddenCharacterRemovalValue(view: Observation, handCount: number): number {
  const known = new Set(
    [
      ...view.own.hand,
      ...view.own.discardPile,
      ...view.own.graveyard,
      ...liveChars(view.own),
      ...view.enemies.flatMap((p) => [...p.discardPile, ...p.graveyard, ...liveChars(p)]),
    ].map((c) => c.cardId),
  )
  const unknown = CHARACTER_CARDS.filter((c) => !known.has(c.id))
  const hiddenSlots = view.actionDeckCount + view.enemies.reduce((n, p) => n + p.handCount, 0)
  const hiddenCharacters = Math.max(
    0,
    Math.min(hiddenSlots, unknown.length - view.characterPoolCount),
  )
  if (!hiddenSlots || !hiddenCharacters || !unknown.length) return 0
  let noCharacter = 1
  for (let i = 0; i < Math.min(handCount, hiddenSlots); i++) {
    noCharacter *= Math.max(0, hiddenSlots - hiddenCharacters - i) / (hiddenSlots - i)
  }
  return ((1 - noCharacter) * unknown.reduce((n, c) => n + c.maxHp + c.attack, 0)) / unknown.length
}

export function scoreAction(view: Observation, catalog: Catalog, action: AiAction): number {
  const { own } = view
  const actor = 'charUid' in action ? ownChar(view, action.charUid) : undefined
  const cost = cardCost(view)
  if (action.type === 'attack' || action.type === 'directAttack') {
    const enemy = view.enemies.find((p) => p.id === action.targetPlayerId)
    return actor && enemy
      ? attackUtility(
          view,
          actor,
          enemy,
          action.type === 'attack' ? action.targetCharUid : undefined,
          action.type === 'attack' && action.armorPierce,
        )
      : 0
  }
  if (action.type === 'deploy' || action.type === 'replace') {
    const card = own.hand.find((c) => c.uid === action.cardUid)
    const def = card && getCharacterDef(card.cardId)
    if (!def) return 0
    let value = def.maxHp + def.attack - CARD_VALUE
    if (action.type === 'replace')
      return value - (actor ? boardValue(actor) + bestAttack(view, actor) : 0)
    if (def.keywords.includes('guardian'))
      value += [action.position - 1, action.position + 1].reduce((n, index) => {
        const neighbor = own.deployed[index]?.character
        return n + (neighbor ? Math.min(def.maxHp, incomingDamage(view, neighbor)) : 0)
      }, 0)
    return value
  }
  if (action.type === 'useEquipment' && actor) {
    const condition = actor.buffs.find((b) => b.type === 'conditionalBonus')?.source.split(':')[1]
    return (
      drawValue(view, Math.min(condition === 'scry5pick2' ? 2 : 1, view.actionDeckCount)) -
      bestAttack(view, actor) -
      (condition === 'discardToDraw' ? CARD_VALUE : 0)
    )
  }
  if (action.type === 'useSkill' && actor) {
    const skill = getCharacterDef(actor.cardId)?.skills[0]
    if (!skill) return 0
    const apCost = skill.consumeActionPoint ? bestAttack(view, actor) : 0
    const target = ownChar(view, String(action.params.targetCharUid ?? ''))
    const params = skill.effect.params
    switch (skill.effect.type) {
      case 'stealCard':
        return 2 * CARD_VALUE - apCost
      case 'summon':
        return (params.stats?.hp ?? 1) + (params.stats?.attack ?? 1) - apCost
      case 'buffAlly': {
        if (!target) return 0
        const after = {
          ...target,
          buffs: [
            ...target.buffs,
            {
              type: 'attackBoost',
              value: params.atkBoost ?? 1,
              remainingTurns: 1,
              source: actor.uid,
            },
          ],
        }
        return (
          Math.min(params.hpBoost ?? 1, target.maxHp - target.currentHp) +
          bestAttack(view, after) -
          bestAttack(view, target) -
          apCost
        )
      }
      case 'restoreAllyAP':
        return target ? bestAttack(view, { ...target, hasActionPoint: true }) - CARD_VALUE : 0
      case 'scryDraw':
        return drawValue(view, Math.min(params.pickCount ?? 1, view.actionDeckCount)) - apCost
      case 'sacrificeForPower': {
        const after = {
          ...actor,
          buffs: [
            ...actor.buffs,
            {
              type: 'attackBoost',
              value: params.atkBoost ?? 1,
              remainingTurns: 1,
              source: actor.uid,
            },
          ],
        }
        return bestAttack(view, after) - bestAttack(view, actor) - CARD_VALUE
      }
      case 'sacrificeHealAlly':
        return target
          ? target.maxHp -
              target.currentHp +
              bestAttack(view, { ...target, state: 'normal', currentHp: target.maxHp }) -
              bestAttack(view, target) -
              (actor.currentHp - 1) -
              bestAttack(view, actor)
          : 0
      case 'stealDiscard':
        return CARD_VALUE - apCost
      case 'transferDebuff': {
        const ally = liveChars(own).find(
          (c) => c.state === 'normal' && c.uid !== actor.uid && c.debuffs.length,
        )
        if (!ally) return 0
        const after = { ...ally, debuffs: ally.debuffs.slice(1) }
        const casterAfter = { ...actor, debuffs: [...actor.debuffs, ally.debuffs[0]] }
        return (
          bestAttack(view, after) -
          bestAttack(view, ally) +
          bestAttack(view, casterAfter) -
          bestAttack(view, actor) -
          apCost
        )
      }
      default:
        return 0
    }
  }
  if (action.type !== 'playCard') return 0
  const card = own.hand.find((c) => c.uid === action.cardUid)
  if (!card) return 0
  const params = action.params
  const target = ownChar(view, String(params.targetCharUid ?? ''))
  const definition = catalog.actions.find((d) => d.id === card.cardId)
  const available =
    view.actionDeckCount +
    own.discardPile.length +
    view.enemies.reduce((n, p) => n + p.discardPile.length, 0)
  if (definition) {
    switch (definition.actionType) {
      case 'attack':
      case 'armorPierce': {
        const attacker = ownChar(view, String(params.attackerCharUid))
        const enemy = view.enemies.find((p) => p.id === params.targetPlayerId)
        return attacker && enemy
          ? attackUtility(
              view,
              attacker,
              enemy,
              params.targetCharUid ? String(params.targetCharUid) : undefined,
              definition.actionType === 'armorPierce',
            ) - cost
          : 0
      }
      case 'recovery':
        return (
          (params.targetType === 'player'
            ? Math.min(2, own.maxHp - own.hp)
            : target
              ? healValue(view, target)
              : 0) - cost
        )
      case 'bigRecovery':
        return (
          (params.targetType === 'player'
            ? Math.min(5, own.maxHp - own.hp)
            : liveChars(own).reduce((n, c) => n + healValue(view, c), 0)) - cost
        )
      case 'replenish':
        return params.mode === 'recruit'
          ? CHARACTER_CARDS.reduce((n, c) => n + c.maxHp + c.attack, 0) / CHARACTER_CARDS.length -
              3 -
              cost
          : drawValue(view, Math.min(2, view.actionDeckCount || available)) - cost
      case 'bigBlock':
      case 'smallBlock': {
        const apUser = liveChars(own).find(canUseAp)
        const gain =
          definition.actionType === 'bigBlock'
            ? liveChars(own).reduce((n, c) => n + incomingDamage(view, c), 0)
            : target
              ? incomingDamage(view, target)
              : 0
        return gain - (apUser ? bestAttack(view, apUser) : 0) - cost
      }
    }
  }
  const strategy = catalog.strategies.find((d) => d.id === card.cardId)
  if (!strategy) return 0
  if (strategy.strategyType === 'deployable')
    return target ? equipmentValue(view, catalog, card, target) - cost : 0
  switch (strategy.instantType) {
    case 'drawWithBonus': {
      const count = view.actionDeckCount < 2 ? available : view.actionDeckCount
      return drawValue(view, Math.min(2, count) + (count > 2 ? 1 / 4 : 0)) - cost
    }
    case 'drawAndRemoveEvil':
      return drawValue(view, Math.min(2, view.actionDeckCount)) - cost
    case 'suitJudgmentDraw':
      return (
        (drawValue(view, Math.min(3, view.actionDeckCount)) * 2 +
          drawValue(view, Math.min(1, view.actionDeckCount))) /
          4 -
        cost
      )
    case 'unlimitedApThisTurn':
      return (
        liveChars(own)
          .filter((c) => !c.hasActionPoint)
          .reduce((n, c) => n + bestAttack(view, { ...c, hasActionPoint: true }), 0) - cost
      )
    case 'removeDebuff': {
      if (!target) return 0
      const after = { ...target, debuffs: [], silenced: false }
      const futureWeaken = target.debuffs
        .filter((d) => d.type === 'weaken')
        .reduce((n, d) => n + d.value, 0)
      return (
        bestAttack(view, after) -
        bestAttack(view, target) +
        Math.min(target.attack, futureWeaken) -
        cost
      )
    }
    case 'grantCrit':
    case 'grantTempArmorPierce': {
      if (!target) return 0
      const type = strategy.instantType === 'grantCrit' ? 'critOnAttack' : 'armorPierceOnAttack'
      if (target.buffs.some((b) => b.type === type)) return 0
      return (
        bestAttack(view, {
          ...target,
          buffs: [...target.buffs, { type, value: 1, remainingTurns: 1, source: card.uid }],
        }) -
        bestAttack(view, target) -
        cost
      )
    }
    case 'weakenTwoTargets': {
      return (
        [params.targetCharUid1, params.targetCharUid2].reduce<number>((n, uid) => {
          const char = view.enemies.flatMap(liveChars).find((c) => c.uid === uid)
          return n + (char ? Math.min(2, attackPower(char)) : 0)
        }, 0) - cost
      )
    }
    case 'discardUndeployedChar': {
      const enemy = view.enemies.find((p) => p.id === params.targetPlayerId)
      return enemy ? hiddenCharacterRemovalValue(view, enemy.handCount) - cost : 0
    }
    // disarmEquipment expires at the opponent's startTurn before it can prevent
    // an action. Its printed protection is not a modeled runtime benefit.
    case 'stealEquipment': {
      const slot = view.enemies
        .find((p) => p.id === params.targetPlayerId)
        ?.deployed.find((s) => s.character?.uid === params.targetCharUid)
      return slot?.equipment ? retrievedValue(view, catalog, slot.equipment) - cost : 0
    }
    case 'summonFromGraveyard': {
      const def = getCharacterDef(
        own.graveyard.find((c) => c.uid === params.targetCardUid)?.cardId ?? '',
      )
      return def ? def.maxHp + def.attack - cost : 0
    }
    case 'drawCharAndDeploy': {
      const factions = new Set(liveChars(own).map((c) => getCharacterDef(c.cardId)?.faction))
      return (
        CHARACTER_CARDS.reduce(
          (n, c) => n + (factions.has(c.faction) ? c.maxHp + c.attack : 0),
          0,
        ) /
          CHARACTER_CARDS.length -
        cost
      )
    }
    case 'retrieveFromDiscard':
      return (
        retrievedValue(
          view,
          catalog,
          own.discardPile.find((c) => c.uid === params.targetCardUid),
        ) - cost
      )
    case 'retrieveInstantFromDiscard':
      return (
        retrievedValue(
          view,
          catalog,
          own.discardPile.find((c) =>
            catalog.strategies.some((d) => d.id === c.cardId && d.strategyType === 'instant'),
          ),
        ) - cost
      )
    case 'protectNearDeath':
      return target ? bestAttack(view, { ...target, state: 'normal', currentHp: 1 }) - cost : 0
    case 'feverEffect':
      return (
        liveChars(own).reduce(
          (n, c) =>
            n +
            Math.max(0, (getCharacterDef(c.cardId)?.maxHp ?? c.maxHp) - c.currentHp) +
            2 +
            bestAttack(view, {
              ...c,
              buffs: [
                ...c.buffs,
                { type: 'attackBoost', value: 2, remainingTurns: 2, source: card.uid },
              ],
            }) -
            bestAttack(view, c),
          0,
        ) - cost
      )
    default:
      return 0
  }
}

export const actionKey = (action: AiAction): string => JSON.stringify(action)

export function rankActions(view: Observation, catalog: Catalog): Decision[] {
  return enumerateActions(view, catalog)
    .map((action) => ({ action, utility: scoreAction(view, catalog, action) }))
    .filter((d) => Number.isFinite(d.utility) && d.utility > 0)
    .sort(
      (a, b) =>
        b.utility - a.utility ||
        (actionKey(a.action) < actionKey(b.action)
          ? -1
          : actionKey(a.action) > actionKey(b.action)
            ? 1
            : 0),
    )
}
