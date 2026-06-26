// ============================================================
// Simple AI service for single-player mode
// ============================================================

import { Injectable } from '@nestjs/common'
import { GameService } from './game.service'
import { DeckService } from './deck.service'
import { CombatService } from './combat.service'
import { getCharacterDef } from './character-data'
import type { GameState, PlayerState, CardInstance, DeployedCharacter } from './types'

@Injectable()
export class AiService {
  constructor(
    private readonly gameService: GameService,
    private readonly deckService: DeckService,
    private readonly combatService: CombatService,
  ) {}

  /**
   * Execute a simple AI turn.
   * Strategy:
   * 1. Deploy any character cards in hand to empty slots
   * 2. Attack the weakest enemy character with each character that has AP
   * 3. Use block/recovery cards if HP is low
   */
  executeTurn(state: GameState, aiPlayer: PlayerState): void {
    // 1. Deploy characters
    this.deployCharacters(state, aiPlayer)

    // 2. Use character skills
    this.useSkills(state, aiPlayer)

    // 3. Use strategy cards
    this.useStrategyCards(state, aiPlayer)

    // 4. Use action cards (attack, block, replenish)
    this.useActionCards(state, aiPlayer)

    // 5. Attack with available characters
    this.attackEnemies(state, aiPlayer)

    // 6. Use recovery cards if needed
    this.useRecoveryIfNeeded(state, aiPlayer)
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

  /**
   * Use active character skills.
   * Only uses non-AP skills to preserve AP for attacks.
   */
  private useSkills(state: GameState, aiPlayer: PlayerState): void {
    const enemyPlayers = state.players.filter(
      (p) => p.id !== aiPlayer.id && p.isAlive,
    )

    for (const slot of aiPlayer.deployed) {
      if (!slot.character || slot.character.state !== 'normal') continue
      if (slot.character.silenced) continue

      const charDef = getCharacterDef(slot.character.cardId)
      if (!charDef) continue

      for (const skill of charDef.skills) {
        if (!skill.effect) continue
        const effectType = skill.effect.type

        // Skip passive skills
        if (['guardianCounter', 'aoeAttack', 'drawOnNearDeath', 'nearDeathRestriction',
             'veteran', 'silenceOnDeath', 'armorPierceAttack', 'firstCardGuaranteed'].includes(effectType)) {
          continue
        }

        // Only use non-AP skills to preserve AP for attacks
        if (skill.consumeActionPoint) continue

        // Try to use the skill
        this.tryUseSkill(state, aiPlayer, slot.character, effectType, enemyPlayers)
      }
    }
  }

  /**
   * Try to use a specific skill. Returns true if skill was used.
   */
  private tryUseSkill(
    state: GameState,
    aiPlayer: PlayerState,
    character: DeployedCharacter,
    effectType: string,
    enemyPlayers: PlayerState[],
  ): boolean {
    switch (effectType) {
      case 'stealCard': {
        // Steal from enemy with most hand cards
        const target = enemyPlayers.reduce((best, p) =>
          p.hand.length > best.hand.length ? p : best, enemyPlayers[0])
        if (target.hand.length === 0) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'summon': {
        // Summon if empty slot available
        const emptySlot = aiPlayer.deployed.find(s => s.character === null)
        if (!emptySlot) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'buffAlly': {
        // Only buff if we have spare AP (not consuming attack turns)
        // Use on the ally with highest attack
        let bestTarget: string | null = null
        let bestAtk = -1
        for (const slot of aiPlayer.deployed) {
          if (slot.character && slot.character.state === 'normal' && slot.character.uid !== character.uid) {
            if (slot.character.attack > bestAtk) {
              bestAtk = slot.character.attack
              bestTarget = slot.character.uid
            }
          }
        }
        if (!bestTarget) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, { targetCharUid: bestTarget })
        return true
      }

      case 'sacrificeForPower': {
        // Use if we have spare hand cards (more than 2)
        if (aiPlayer.hand.length < 2) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'sacrificeHealAlly': {
        // Only use if an ally is near-death
        const hasNearDeathAlly = aiPlayer.deployed.some(
          s => s.character && s.character.state === 'nearDeath' && s.character.uid !== character.uid,
        )
        if (!hasNearDeathAlly) return false
        // Find the near-death ally
        const target = aiPlayer.deployed.find(
          s => s.character && s.character.state === 'nearDeath' && s.character.uid !== character.uid,
        )
        if (!target?.character) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, { targetCharUid: target.character.uid })
        return true
      }

      case 'transferDebuff': {
        // Use if an ally has debuffs
        const hasDebuffAlly = aiPlayer.deployed.some(
          s => s.character && s.character.state === 'normal' && s.character.debuffs.length > 0 && s.character.uid !== character.uid,
        )
        if (!hasDebuffAlly) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'restoreAllyAP': {
        // Use if an ally has no AP and we have hand cards
        if (aiPlayer.hand.length === 0) return false
        const needsAP = aiPlayer.deployed.some(
          s => s.character && s.character.state === 'normal' && !s.character.hasActionPoint && s.character.uid !== character.uid,
        )
        if (!needsAP) return false
        // Find ally without AP
        const target = aiPlayer.deployed.find(
          s => s.character && s.character.state === 'normal' && !s.character.hasActionPoint && s.character.uid !== character.uid,
        )
        if (!target?.character) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, { targetCharUid: target.character.uid })
        return true
      }

      case 'randomStatAdjust': {
        // Use if we have 3+ deployed characters (more impact)
        const deployedCount = aiPlayer.deployed.filter(s => s.character && s.character.state === 'normal').length
        if (deployedCount < 3) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'grantSkillTrigger': {
        // Buff ally with highest attack before attacking
        let bestTarget: string | null = null
        let bestAtk = -1
        for (const slot of aiPlayer.deployed) {
          if (slot.character && slot.character.state === 'normal' && slot.character.uid !== character.uid) {
            if (slot.character.attack > bestAtk) {
              bestAtk = slot.character.attack
              bestTarget = slot.character.uid
            }
          }
        }
        if (!bestTarget) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, { targetCharUid: bestTarget })
        return true
      }

      case 'scryDraw': {
        // Always use if deck has cards
        if (state.actionDeck.length === 0) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'counterAttack': {
        // Use if enemies have cards (likely to attack)
        const enemiesWithCards = enemyPlayers.some(p => p.hand.length > 0)
        if (!enemiesWithCards) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      case 'stealDiscard': {
        // Use if enemies have cards (likely to discard)
        const enemiesWithCards = enemyPlayers.some(p => p.hand.length > 0)
        if (!enemiesWithCards) return false
        this.gameService.useSkill(state, aiPlayer.id, character.uid, {})
        return true
      }

      default:
        return false
    }
  }

  /**
   * Use strategy cards: equip deployable cards, then use instant cards.
   */
  private useStrategyCards(state: GameState, aiPlayer: PlayerState): void {
    const strategyCards = aiPlayer.hand.filter(
      (c) => this.deckService.getStrategyCardDef(c.cardId) !== undefined,
    )

    // First: equip deployable strategy cards to characters without equipment
    for (const card of [...strategyCards]) {
      const def = this.deckService.getStrategyCardDef(card.cardId)!
      if (def.strategyType !== 'deployable') continue

      // Find a deployed character without equipment (prefer highest attack)
      let bestSlot = -1
      let bestAtk = -1
      for (let i = 0; i < aiPlayer.deployed.length; i++) {
        const slot = aiPlayer.deployed[i]
        if (slot.character && slot.character.state === 'normal' && !slot.equipment) {
          if (slot.character.attack > bestAtk) {
            bestAtk = slot.character.attack
            bestSlot = i
          }
        }
      }

      if (bestSlot >= 0) {
        const targetChar = aiPlayer.deployed[bestSlot].character!
        this.gameService.playCard(state, aiPlayer.id, card.uid, {
          targetCharUid: targetChar.uid,
        })
      }
    }

    // Second: use instant strategy cards
    const remainingInstant = aiPlayer.hand.filter(
      (c) => {
        const def = this.deckService.getStrategyCardDef(c.cardId)
        return def && def.strategyType === 'instant'
      },
    )

    for (const card of remainingInstant) {
      const def = this.deckService.getStrategyCardDef(card.cardId)!
      const params = this.chooseInstantTarget(state, aiPlayer, def)
      if (params !== null) {
        this.gameService.playCard(state, aiPlayer.id, card.uid, params)
      }
    }
  }

  /**
   * Choose target params for an instant strategy card.
   * Returns null if the card should not be used right now.
   */
  private chooseInstantTarget(
    state: GameState,
    aiPlayer: PlayerState,
    def: { id: string; instantType?: string; requiresTarget: boolean },
  ): Record<string, any> | null {
    const t = def.instantType ?? ''
    const enemyPlayers = state.players.filter((p) => p.id !== aiPlayer.id && p.isAlive)

    switch (t) {
      // Cards that target enemy characters
      case 'disarmEquipment': {
        // Target enemy with equipment
        for (const enemy of enemyPlayers) {
          for (const slot of enemy.deployed) {
            if (slot.character && slot.equipment) {
              return { targetPlayerId: enemy.id, targetCharUid: slot.character.uid }
            }
          }
        }
        return null
      }

      case 'stealEquipment': {
        for (const enemy of enemyPlayers) {
          for (const slot of enemy.deployed) {
            if (slot.character && slot.equipment) {
              return { targetPlayerId: enemy.id, targetCharUid: slot.character.uid }
            }
          }
        }
        return null
      }

      case 'silenceTarget': {
        // Silence strongest enemy character
        let bestTarget: { playerId: string; charUid: string } | null = null
        let bestAtk = -1
        for (const enemy of enemyPlayers) {
          for (const slot of enemy.deployed) {
            if (slot.character && slot.character.state === 'normal' && !slot.character.silenced) {
              if (slot.character.attack > bestAtk) {
                bestAtk = slot.character.attack
                bestTarget = { playerId: enemy.id, charUid: slot.character.uid }
              }
            }
          }
        }
        return bestTarget ? { targetPlayerId: bestTarget.playerId, targetCharUid: bestTarget.charUid } : null
      }

      case 'disableFactionSkill': {
        if (enemyPlayers.length > 0) {
          return { targetPlayerId: enemyPlayers[0].id }
        }
        return null
      }

      case 'placeJudgment': {
        if (enemyPlayers.length > 0) {
          return { targetPlayerId: enemyPlayers[0].id }
        }
        return null
      }

      case 'placeJudgmentPass': {
        if (enemyPlayers.length > 0) {
          return { targetPlayerId: enemyPlayers[0].id }
        }
        return null
      }

      case 'discardUndeployedChar': {
        // Target enemy with character cards in hand
        for (const enemy of enemyPlayers) {
          const charCards = enemy.hand.filter((c) => getCharacterDef(c.cardId) !== undefined)
          if (charCards.length > 0) {
            return { targetPlayerId: enemy.id, targetCardUid: charCards[0].uid }
          }
        }
        return null
      }

      case 'viewHand': {
        if (enemyPlayers.length > 0) {
          return { targetPlayerId: enemyPlayers[0].id }
        }
        return null
      }

      // Cards that target ally characters
      case 'grantTempArmorPierce': {
        for (const slot of aiPlayer.deployed) {
          if (slot.character && slot.character.state === 'normal' && slot.character.hasActionPoint) {
            return { targetCharUid: slot.character.uid }
          }
        }
        return null
      }

      case 'grantCrit': {
        for (const slot of aiPlayer.deployed) {
          if (slot.character && slot.character.state === 'normal' && slot.character.hasActionPoint) {
            return { targetCharUid: slot.character.uid }
          }
        }
        return null
      }

      case 'forceEarthStore': {
        // Use on lowest HP character
        let lowestHp = Infinity
        let targetUid = ''
        for (const slot of aiPlayer.deployed) {
          if (slot.character && slot.character.state === 'normal') {
            if (slot.character.currentHp < lowestHp) {
              lowestHp = slot.character.currentHp
              targetUid = slot.character.uid
            }
          }
        }
        return targetUid ? { targetCharUid: targetUid } : null
      }

      case 'weakenTwoTargets': {
        // Weaken two strongest enemy characters
        const targets: { playerId: string; charUid: string }[] = []
        for (const enemy of enemyPlayers) {
          for (const slot of enemy.deployed) {
            if (slot.character && slot.character.state === 'normal') {
              targets.push({ playerId: enemy.id, charUid: slot.character.uid })
            }
          }
        }
        targets.sort((a, b) => {
          const aChar = enemyPlayers.flatMap(e => e.deployed).find(s => s.character?.uid === a.charUid)?.character
          const bChar = enemyPlayers.flatMap(e => e.deployed).find(s => s.character?.uid === b.charUid)?.character
          return (bChar?.attack ?? 0) - (aChar?.attack ?? 0)
        })
        if (targets.length >= 2) {
          return {
            targetPlayerId: targets[0].playerId,
            targetCharUid1: targets[0].charUid,
            targetCharUid2: targets[1].charUid,
          }
        }
        return null
      }

      case 'swapPositions': {
        // Swap two ally characters if beneficial
        const allies = aiPlayer.deployed.filter(s => s.character && s.character.state === 'normal')
        if (allies.length >= 2) {
          return {
            charUid1: allies[0].character!.uid,
            charUid2: allies[1].character!.uid,
          }
        }
        return null
      }

      // Cards that don't need targets — always useful
      case 'allPlayersDraw':
      case 'slotMachine':
      case 'suitJudgmentDraw':
      case 'drawAndRemoveEvil':
      case 'removeDebuff': {
        return {}
      }

      case 'retrieveFromDiscard': {
        if (aiPlayer.discardPile.length > 0) {
          return {}
        }
        return null
      }

      case 'retrieveInstantFromDiscard': {
        const hasInstant = aiPlayer.discardPile.some((c) => {
          const d = this.deckService.getStrategyCardDef(c.cardId)
          return d && d.strategyType === 'instant'
        })
        return hasInstant ? {} : null
      }

      case 'summonFromGraveyard': {
        if (aiPlayer.graveyard.length > 0) {
          return {}
        }
        return null
      }

      case 'unlimitedApThisTurn': {
        // Use if we have characters that haven't acted
        const hasUnusedAp = aiPlayer.deployed.some(
          (s) => s.character && s.character.state === 'normal' && s.character.hasActionPoint,
        )
        return hasUnusedAp ? {} : null
      }

      case 'feverEffect': {
        return {} // Always try it
      }

      case 'drawCharAndDeploy': {
        // Use if there are empty slots and characters in pool
        const hasEmpty = aiPlayer.deployed.some(s => s.character === null)
        return hasEmpty && state.characterPool.length > 0 ? {} : null
      }

      case 'removeJudgment': {
        // Use if AI has judgment cards in its zone
        return aiPlayer.judgmentZone.length > 0 ? { targetPlayerId: aiPlayer.id } : null
      }

      case 'protectNearDeath': {
        // Use if any deployed character is in near-death state
        const hasNearDeath = aiPlayer.deployed.some(
          s => s.character && s.character.state === 'nearDeath',
        )
        return hasNearDeath ? {} : null
      }

      case 'russianRoulette': {
        // Use if enemy has higher HP
        const enemyPlayers = state.players.filter(p => p.id !== aiPlayer.id && p.isAlive)
        const enemy = enemyPlayers[0]
        if (!enemy) return null
        return enemy.hp > aiPlayer.hp ? { targetPlayerId: enemy.id } : null
      }

      case 'swapHandWithPlayers': {
        // Use if AI has fewer cards than enemy
        const enemies = state.players.filter(p => p.id !== aiPlayer.id && p.isAlive)
        const enemy = enemies[0]
        if (!enemy) return null
        return aiPlayer.hand.length < enemy.hand.length ? {} : null
      }

      case 'duelMode': {
        // Use against enemies with more attack cards
        const enemies = state.players.filter(p => p.id !== aiPlayer.id && p.isAlive)
        const enemy = enemies[0]
        if (!enemy) return null
        return { targetPlayerId: enemy.id }
      }

      case 'counterInstant':
      case 'counterSkill':
      case 'chanceIgnoreSkill':
      case 'maintainFactionSkill':
        // Defensive cards — use if enemies have cards
        return {}

      default:
        return null
    }
  }

  /**
   * Use action cards from hand: attack cards, block cards, replenish.
   */
  private useActionCards(state: GameState, aiPlayer: PlayerState): void {
    const enemyPlayers = state.players.filter(
      (p) => p.id !== aiPlayer.id && p.isAlive,
    )
    if (enemyPlayers.length === 0) return

    // Find action cards in hand
    const actionCards = aiPlayer.hand.filter((c) => {
      const def = this.deckService.actionCardDefs.find((d) => d.id === c.cardId)
      return def !== undefined
    })

    // Use replenish cards first (draw more cards)
    for (const card of [...actionCards]) {
      const def = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
      if (!def || def.actionType !== 'replenish') continue

      // If character pool has characters and we have empty slots, recruit
      const hasEmpty = aiPlayer.deployed.some((s) => s.character === null)
      if (hasEmpty && state.characterPool.length > 0) {
        this.gameService.playCard(state, aiPlayer.id, card.uid, { mode: 'recruit' })
      } else {
        // Otherwise draw cards
        this.gameService.playCard(state, aiPlayer.id, card.uid, {})
      }
    }

    // Use block cards preventively when we have deployed characters
    const hasDeployedChars = aiPlayer.deployed.some(
      (s) => s.character && s.character.state === 'normal',
    )

    if (hasDeployedChars) {
      for (const card of [...actionCards]) {
        const def = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
        if (!def) continue

        if (def.actionType === 'bigBlock') {
          this.gameService.playCard(state, aiPlayer.id, card.uid, {})
        } else if (def.actionType === 'smallBlock') {
          // Apply to the character with lowest HP
          let lowestHp = Infinity
          let targetUid = ''
          for (const slot of aiPlayer.deployed) {
            if (slot.character && slot.character.state === 'normal') {
              if (slot.character.currentHp < lowestHp) {
                lowestHp = slot.character.currentHp
                targetUid = slot.character.uid
              }
            }
          }
          if (targetUid) {
            this.gameService.playCard(state, aiPlayer.id, card.uid, { targetCharUid: targetUid })
          }
        }
      }
    }

    // Use attack cards from hand (in addition to built-in attacks)
    for (const card of [...actionCards]) {
      const def = this.deckService.actionCardDefs.find((d) => d.id === card.cardId)
      if (!def) continue

      if (def.actionType === 'attack' || def.actionType === 'armorPierce') {
        // Find best target
        const target = this.findBestAttackTarget(state, aiPlayer, enemyPlayers)
        if (target) {
          this.gameService.playCard(state, aiPlayer.id, card.uid, {
            targetPlayerId: target.playerId,
            targetCharUid: target.charUid,
          })
        }
      }
    }
  }

  private getCharMaxHp(char: DeployedCharacter): number {
    const charDef = getCharacterDef(char.cardId)
    return charDef?.maxHp ?? char.maxHp
  }

  /**
   * Find the best attack target for action cards.
   */
  private findBestAttackTarget(
    state: GameState,
    aiPlayer: PlayerState,
    enemyPlayers: PlayerState[],
  ): { playerId: string; charUid: string } | null {
    let bestTarget: { playerId: string; charUid: string } | null = null
    let lowestHp = Infinity

    for (const enemy of enemyPlayers) {
      for (const slot of enemy.deployed) {
        if (!slot.character) continue
        if (slot.character.state === 'retired') continue
        if (slot.character.keywords.includes('untargetable')) continue

        // Near-death targets are top priority
        if (slot.character.state === 'nearDeath') {
          return { playerId: enemy.id, charUid: slot.character.uid }
        }

        if (slot.character.state === 'normal' && slot.character.currentHp < lowestHp) {
          lowestHp = slot.character.currentHp
          bestTarget = { playerId: enemy.id, charUid: slot.character.uid }
        }
      }
    }

    return bestTarget
  }

  private attackEnemies(state: GameState, aiPlayer: PlayerState): void {
    const enemyPlayers = state.players.filter(
      (p) => p.id !== aiPlayer.id && p.isAlive,
    )

    for (const slot of aiPlayer.deployed) {
      if (!slot.character || slot.character.state !== 'normal' || !slot.character.hasActionPoint) {
        continue
      }

      // Skip characters with disarm debuff
      if (slot.character.debuffs.some((d) => d.type === 'disarm')) {
        continue
      }

      // Check if this character has aoeAttack keyword
      const hasAoe = slot.character.keywords.includes('aoeAttack')
      const armorPierce = slot.character.keywords.includes('armorPierce')

      if (hasAoe) {
        // AoE: attack all enemies with lowest HP
        for (const enemy of enemyPlayers) {
          const targets = enemy.deployed
            .filter((s) => s.character && s.character.state === 'normal')
            .filter((s) => !s.character!.keywords.includes('untargetable'))

          if (targets.length > 0) {
            // Pick lowest HP target for AoE
            const weakest = targets.reduce((a, b) =>
              (a.character!.currentHp < b.character!.currentHp) ? a : b,
            )
            if (weakest.character) {
              this.combatService.resolveAttack(
                state,
                aiPlayer.id,
                slot.character.uid,
                enemy.id,
                weakest.character.uid,
                armorPierce,
              )
            }
            break // AoE hits all, just need one attack declaration
          }
        }
        continue
      }

      // Single target: find best target
      let bestTarget: { playerId: string; charUid: string } | null = null
      let bestPriority = -1
      let lowestHp = Infinity

      for (const enemy of enemyPlayers) {
        for (const enemySlot of enemy.deployed) {
          if (!enemySlot.character) continue
          if (enemySlot.character.state === 'retired') continue

          // Skip untargetable
          if (enemySlot.character.keywords.includes('untargetable')) continue

          // Skip immunity (waste of attack)
          if (enemySlot.character.keywords.includes('immunity')) continue

          // Near-death targets are top priority
          if (enemySlot.character.state === 'nearDeath') {
            bestTarget = { playerId: enemy.id, charUid: enemySlot.character.uid }
            bestPriority = 10
            break
          }

          // Otherwise pick lowest HP among normal targets
          if (enemySlot.character.state === 'normal' && bestPriority < 10) {
            if (enemySlot.character.currentHp < lowestHp) {
              lowestHp = enemySlot.character.currentHp
              bestTarget = { playerId: enemy.id, charUid: enemySlot.character.uid }
            }
          }
        }
        if (bestPriority >= 10) break
      }

      // If no character targets, try direct player attack
      if (!bestTarget) {
        for (const enemy of enemyPlayers) {
          const hasDeployed = enemy.deployed.some(
            (s) => s.character && s.character.state !== 'retired',
          )
          if (!hasDeployed) {
            this.combatService.resolveDirectAttack(
              state,
              aiPlayer.id,
              slot.character.uid,
              enemy.id,
            )
            break
          }
        }
        continue
      }

      if (bestTarget) {
        this.combatService.resolveAttack(
          state,
          aiPlayer.id,
          slot.character.uid,
          bestTarget.playerId,
          bestTarget.charUid,
          armorPierce,
        )
      }
    }
  }

  private useRecoveryIfNeeded(state: GameState, aiPlayer: PlayerState): void {
    // Count damaged and near-death characters
    let damagedCount = 0
    let nearDeathSlot: typeof aiPlayer.deployed[0] | null = null

    for (const slot of aiPlayer.deployed) {
      if (!slot.character || slot.character.state === 'retired') continue
      if (slot.character.state === 'nearDeath') {
        nearDeathSlot = slot
        damagedCount++
      } else {
        const maxHp = this.getCharMaxHp(slot.character)
        if (slot.character.currentHp < maxHp) damagedCount++
      }
    }

    // Use bigRecovery if any character is damaged
    if (damagedCount >= 1) {
      const bigRecoveryCard = aiPlayer.hand.find((c) => {
        const def = this.deckService.actionCardDefs.find((d) => d.id === c.cardId)
        return def && def.actionType === 'bigRecovery'
      })
      if (bigRecoveryCard) {
        this.gameService.playCard(state, aiPlayer.id, bigRecoveryCard.uid, {})
      }
    }

    // Use recovery on near-death character
    if (nearDeathSlot?.character) {
      const recoveryCard = aiPlayer.hand.find((c) => {
        const def = this.deckService.actionCardDefs.find((d) => d.id === c.cardId)
        return def && def.actionType === 'recovery'
      })
      if (recoveryCard) {
        this.gameService.playCard(state, aiPlayer.id, recoveryCard.uid, {
          targetCharUid: nearDeathSlot.character.uid,
        })
      }
    }

    // If player HP is low and no deployed characters, use recovery on player
    if (aiPlayer.hp < aiPlayer.maxHp / 2) {
      const hasDeployed = aiPlayer.deployed.some(
        (s) => s.character && s.character.state !== 'retired',
      )
      if (!hasDeployed) {
        const recoveryCard = aiPlayer.hand.find((c) => {
          const def = this.deckService.actionCardDefs.find((d) => d.id === c.cardId)
          return def && (def.actionType === 'recovery' || def.actionType === 'bigRecovery')
        })
        if (recoveryCard) {
          this.gameService.playCard(state, aiPlayer.id, recoveryCard.uid, {
            targetType: 'player',
          })
        }
      }
    }
  }
}
