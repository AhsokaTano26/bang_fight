// C0012 做了！: Weaken two targets

import { addLog, StrategyContext, StrategyResult } from '../utils'

export function weakenTwoTargets(ctx: StrategyContext): StrategyResult {
  const { state, player, params } = ctx
  const { targetCharUid1, targetCharUid2, targetPlayerId } = params
  if (!targetCharUid1 || !targetCharUid2 || targetCharUid1 === targetCharUid2) {
    return { success: false, message: '需要指定两名不同的场上角色' }
  }
  const owners = state.players.filter(
    (p) => p.isAlive && (!targetPlayerId || p.id === targetPlayerId),
  )
  const candidates = owners.flatMap((p) =>
    p.deployed.flatMap((s) =>
      s.character && s.character.state !== 'retired' ? [s.character] : [],
    ),
  )
  const matches = [targetCharUid1, targetCharUid2].map((uid) =>
    candidates.filter((c) => c.uid === uid),
  )
  if (matches.some((chars) => chars.length !== 1))
    return { success: false, message: '未找到两名有效且唯一的场上角色' }

  // Validate the entire pair before mutating either target or consuming the card.
  for (const [char] of matches) {
    char.debuffs.push({
      type: 'weaken',
      value: 2,
      remainingTurns: 2,
      source: 'weakenCard',
    })
  }

  addLog(state, player.id, '做了！: 削弱了2个角色')
  return { success: true, message: '削弱了2个角色' }
}
