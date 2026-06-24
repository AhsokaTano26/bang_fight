// ============================================================
// Dice and probability judgment service
// ============================================================

import { Injectable } from '@nestjs/common'
import type { Suit } from './types'

@Injectable()
export class DiceService {
  /**
   * Roll a dice with the given number of sides.
   */
  rollDice(sides: number = 6): number {
    return Math.floor(Math.random() * sides) + 1
  }

  /**
   * Probability check based on the given rate string.
   * Success thresholds:
   *   '1/2' → roll >= 4 (4,5,6)
   *   '1/3' → roll >= 5 (5,6)
   *   '2/3' → roll >= 3 (3,4,5,6)
   *   '1/6' → roll >= 6 (6)
   *   '5/6' → roll >= 2 (2,3,4,5,6)
   */
  probabilityCheck(rate: string): boolean {
    const roll = this.rollDice(6)
    let success = false

    switch (rate) {
      case '1/2':
        success = roll >= 4
        break
      case '1/3':
        success = roll >= 5
        break
      case '2/3':
        success = roll >= 3
        break
      case '1/6':
        success = roll >= 6
        break
      case '5/6':
        success = roll >= 2
        break
      default:
        success = false
    }

    return success
  }

  /**
   * Suit judgment: roll a dice and map to a suit.
   * 1-2 = hearts, 3-4 = diamonds, 5 = clubs, 6 = spades
   */
  suitJudgment(): Suit {
    const roll = this.rollDice(6)
    switch (roll) {
      case 1:
      case 2:
        return 'hearts'
      case 3:
      case 4:
        return 'diamonds'
      case 5:
        return 'clubs'
      case 6:
        return 'spades'
      default:
        return 'hearts'
    }
  }

  isPowerful(suit: Suit): boolean {
    return suit === 'spades'
  }

  isHappy(suit: Suit): boolean {
    return suit === 'hearts'
  }

  isPure(suit: Suit): boolean {
    return suit === 'clubs'
  }

  /**
   * Check if a suit matches a named condition.
   */
  checkSuitCondition(suit: Suit, condition: string): boolean {
    switch (condition) {
      case 'Powerful':
        return this.isPowerful(suit)
      case 'Happy':
        return this.isHappy(suit)
      case 'Pure':
        return this.isPure(suit)
      default:
        return false
    }
  }
}
