// C0008 灵光一闪: 1/2 chance to ignore next skill targeting allies

import { addLog, randomInt, StrategyContext, StrategyResult } from '../utils'

export function chanceIgnoreSkill(ctx: StrategyContext): StrategyResult {
  const { state, player } = ctx

  const success = randomInt(1, 2) === 1
  if (success) {
    // Grant ignoreNextSkill buff to all deployed allies
    for (const slot of player.deployed) {
      if (slot.character && slot.character.state !== 'retired') {
        slot.character.buffs.push({
          type: 'ignoreNextSkill',
          value: 1,
          remainingTurns: 1,
          source: 'C0008',
        })
      }
    }
    addLog(state, player.id, '灵光一闪: 成功！下次技能无效')
    return { success: true, message: '灵光一闪: 下次技能无效' }
  }
  addLog(state, player.id, '灵光一闪: 失败')
  return { success: true, message: '灵光一闪: 判定失败' }
}
