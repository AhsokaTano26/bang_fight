import type { DeployedCharacter, DeployedSlot } from '../types'

/** Shared by resolution and evaluation: keep deterministic combat arithmetic in one place. */
export function attackPower(char: DeployedCharacter): number {
  return Math.max(
    0,
    char.attack +
      char.buffs.filter((b) => b.type === 'attackBoost').reduce((n, b) => n + b.value, 0) -
      char.debuffs.filter((d) => d.type === 'weaken').reduce((n, d) => n + d.value, 0),
  )
}

export function canUseAp(char: DeployedCharacter): boolean {
  return (
    char.state === 'normal' &&
    char.hasActionPoint &&
    !char.debuffs.some((d) => d.type === 'loseAbility')
  )
}

export function canAttack(char: DeployedCharacter): boolean {
  return canUseAp(char) && !char.debuffs.some((d) => d.type === 'disarm')
}

export function redirectedTarget(
  slots: DeployedSlot[],
  targetUid: string,
  pierce: boolean,
  ignoreGuardian: boolean,
) {
  const slotIndex = slots.findIndex((s) => s.character?.uid === targetUid)
  if (slotIndex < 0) return undefined
  const char = slots[slotIndex].character!
  if (!pierce && !ignoreGuardian && !char.keywords.includes('guardian')) {
    for (const index of [slotIndex - 1, slotIndex + 1]) {
      const guardian = slots[index]?.character
      if (guardian?.state === 'normal' && guardian.keywords.includes('guardian'))
        return { char: guardian, slotIndex: index }
    }
  }
  return { char, slotIndex }
}

export function nearDeathProbability(maxHp: number, hp: number): number {
  const lost = maxHp - hp
  return lost > 6 ? 1 / 6 : lost >= 4 ? 1 / 3 : 1 / 2
}

export interface AttackOutcome {
  probability: number
  damage: number
  armorDamage: number
  blockDamage: number
  spreadDamage: number
  retired: boolean
  counterProbability: number
}

/** Enumerates crit outcomes; it never rolls dice or mutates either character. */
export function attackOutcomes(
  attacker: DeployedCharacter,
  target: DeployedCharacter,
  pierce: boolean,
): AttackOutcome[] {
  const effectivePierce =
    pierce ||
    attacker.keywords.includes('armorPierce') ||
    attacker.buffs.some((b) => b.type === 'armorPierceOnAttack')
  const crit = attacker.buffs.some((b) => b.type === 'critOnAttack')
  return (crit ? [1, 2] : [1]).flatMap((multiplier): AttackOutcome[] => {
    const raw = attackPower(attacker) * multiplier
    const armorDamage =
      target.keywords.includes('immunity') || effectivePierce ? 0 : Math.min(target.armor, raw)
    const blocked = target.buffs.some((b) => b.type === 'block' && b.value > 0)
    const damage =
      target.keywords.includes('immunity') || blocked ? 0 : Math.max(0, raw - armorDamage)
    const blockDamage =
      !target.keywords.includes('immunity') && blocked ? Math.max(0, raw - armorDamage) : 0
    const forced = damage > 0 && attacker.buffs.some((b) => b.type === 'forceRetireOnHit')
    const retiringHit =
      !target.keywords.includes('immunity') && (damage >= target.currentHp || forced)
    const earthStore = retiringHit && target.keywords.includes('earthStore')
    const retired = retiringHit && !earthStore
    const hpAfter = retiringHit ? (earthStore ? 1 : 0) : target.currentHp - damage
    const stateAfter = earthStore ? 'normal' : target.state
    const nearDeath =
      damage > 0 && !retired && stateAfter !== 'nearDeath'
        ? nearDeathProbability(target.maxHp, hpAfter)
        : 0
    const recovers = nearDeath > 0 && target.buffs.some((b) => b.type === 'nearDeathRecover')
    const counterProbability =
      target.keywords.includes('immunity') || retired || stateAfter === 'nearDeath'
        ? 0
        : target.keywords.includes('counter')
          ? recovers
            ? 1
            : 1 - nearDeath
          : 0
    const outcome: AttackOutcome = {
      probability: crit ? 1 / 2 : 1,
      // Utility follows final net HP, including earth-store and full recovery.
      damage: target.currentHp - hpAfter,
      armorDamage,
      blockDamage,
      spreadDamage: damage,
      retired,
      counterProbability,
    }
    if (recovers)
      return [
        { ...outcome, probability: outcome.probability * (1 - nearDeath) },
        {
          ...outcome,
          probability: outcome.probability * nearDeath,
          damage: target.currentHp - target.maxHp,
        },
      ]
    return [outcome]
  })
}
