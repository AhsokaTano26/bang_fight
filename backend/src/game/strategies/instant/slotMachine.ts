// C0002 老虎机: Random effect

import { addLog, randomInt, StrategyContext, StrategyResult } from '../utils'

export function slotMachine(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  const roll = randomInt(1, 6)
  let msg = ''

  switch (roll) {
    case 1: // 1 damage to random enemy
      {
        const enemies = state.players.filter(p => p.id !== player.id && p.isAlive)
        if (enemies.length > 0) {
          const target = enemies[randomInt(0, enemies.length - 1)]
          target.hp -= 1
          msg = `老虎机: 对${target.name}造成1点伤害`
        }
      }
      break
    case 2: // Heal 1 HP
      player.hp = Math.min(player.hp + 1, player.maxHp)
      msg = '老虎机: 恢复1点体力'
      break
    case 3: // Draw 1 card
      if (state.actionDeck.length > 0) {
        const drawn = state.actionDeck.splice(0, 1)
        player.hand.push(...drawn)
        msg = '老虎机: 摸1张牌'
      }
      break
    case 4: // +1 armor to all own characters
      for (const slot of player.deployed) {
        if (slot.character && slot.character.state === 'normal') {
          slot.character.armor += 1
        }
      }
      msg = '老虎机: 所有角色+1护甲'
      break
    case 5: // 2 damage to self
      player.hp -= 2
      msg = '老虎机: 自己受到2点伤害'
      break
    case 6: // Draw 2 cards
      if (state.actionDeck.length > 0) {
        const drawn = state.actionDeck.splice(0, Math.min(2, state.actionDeck.length))
        player.hand.push(...drawn)
        msg = '老虎机: 摸2张牌'
      }
      break
  }

  addLog(state, player.id, msg)
  return { success: true, message: msg }
}
