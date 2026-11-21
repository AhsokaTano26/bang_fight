import { card, character, deployedCard, fixture, player } from './test-fixtures'
import { observe } from './observation'
import { rankActions } from './scoring'

describe('AI utility turns using the real game services', () => {
  beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0))
  afterEach(() => jest.restoreAllMocks())

  it('uses newly drawn recovery, then spends its restored AP', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[0].character!.hasActionPoint = false
    own.deployed[0].character!.currentHp = 1
    own.hand = [card('E0001')]
    state.actionDeck = [card('BIG_RECOVERY_1'), card('ATK_1')]
    ai.executeTurn(state, own)
    expect(own.discardPile.map((c) => c.cardId)).toEqual(
      expect.arrayContaining(['E0001', 'BIG_RECOVERY_1']),
    )
    expect(enemy.deployed[0].character!.currentHp).toBe(8)
  })

  it('deploys recruited characters in the same turn', () => {
    const { state, own, ai } = fixture()
    own.hand = [card('REPLENISH_1')]
    state.characterPool = [card('PAS1001', 'recruit')]
    ai.executeTurn(state, own)
    expect(own.deployed.some((s) => s.character?.uid === 'recruit')).toBe(true)
  })

  it('restores AP after attacking and attacks again', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[1].character = deployedCard('HHW1001', 'support')
    own.deployed[1].character.attack = 0
    own.hand = [card('ATK_1')]
    ai.executeTurn(state, own)
    expect(enemy.deployed[0].character!.currentHp).toBe(6)
  })

  it('uses one sufficient recovery and keeps the redundant card', () => {
    const { state, own, ai } = fixture()
    own.deployed[0].character!.state = 'nearDeath'
    own.deployed[0].character!.hasActionPoint = false
    own.deployed[0].character!.currentHp = 1
    own.hand = [card('BIG_RECOVERY_1'), card('RECOVERY_1')]
    // No attack opportunity, so a second card cannot buy another useful AP.
    state.players[1].deployed[0].character!.keywords = ['immunity']
    ai.executeTurn(state, own)
    expect(own.hand.filter((c) => c.cardId.includes('RECOVERY'))).toHaveLength(1)
  })

  it('wins with an available attack before spending AP on blocks', () => {
    const { state, own, enemy, ai } = fixture()
    own.hand = [card('BIG_BLOCK_1'), card('SMALL_BLOCK_1')]
    enemy.deployed[0].character!.currentHp = 2
    ai.executeTurn(state, own)
    expect(state.gameOver).toBe(true)
    expect(state.winner).toBe('ai')
    expect(own.hand).toHaveLength(2)
  })

  it('chooses a damaging target instead of an adjacent immune guardian', () => {
    const { state, enemy, own, ai } = fixture()
    enemy.deployed[0].character = character('bait', { currentHp: 1 })
    enemy.deployed[1].character = character('guardian', { keywords: ['guardian', 'immunity'] })
    enemy.deployed[4].character = character('open', { currentHp: 7 })
    ai.executeTurn(state, own)
    expect(enemy.deployed[4].character!.currentHp).toBe(5)
    expect(enemy.deployed[0].character!.currentHp).toBe(1)
  })

  it('removes a single-use block to create a later attack opportunity', () => {
    const { state, enemy, own, ai } = fixture()
    enemy.deployed[0].character!.buffs.push({
      type: 'block',
      value: 1,
      remainingTurns: 2,
      source: 'test',
    })
    ai.executeTurn(state, own)
    expect(enemy.deployed[0].character!.buffs[0].value).toBe(0)
    expect(own.deployed[0].character!.hasActionPoint).toBe(false)
  })

  it('spends armor-piercing cards with a complete actor/target selection', () => {
    const { state, enemy, own, ai } = fixture()
    enemy.deployed[0].character!.armor = 10
    own.hand = [card('ARMOR_1')]
    ai.executeTurn(state, own)
    expect(own.discardPile.some((c) => c.cardId === 'ARMOR_1')).toBe(true)
    expect(enemy.deployed[0].character!.currentHp).toBe(8)
  })

  it('cleanses a disarmed character and then attacks', () => {
    const { state, enemy, own, ai } = fixture()
    own.deployed[0].character!.debuffs.push({
      type: 'disarm',
      value: 1,
      remainingTurns: 2,
      source: 'test',
    })
    own.hand = [card('D0009')]
    ai.executeTurn(state, own)
    expect(own.deployed[0].character!.debuffs).toEqual([])
    expect(enemy.deployed[0].character!.currentHp).toBe(8)
  })

  it('does not inspect hidden hand cards or hidden deck identities', () => {
    const run = (hiddenCard: string, deckCard: string) => {
      const { state, own, enemy, deck } = fixture()
      own.hand = [card('A0004')]
      enemy.hand = [card(hiddenCard, 'hidden')]
      state.actionDeck = [card(deckCard, 'deck-hidden')]
      // Compare the decision before resolution: actual rule outcomes may reveal
      // different information and legitimately change subsequent decisions.
      return rankActions(observe(state, own.id)!, {
        actions: deck.actionCardDefs,
        strategies: deck.strategyCardDefs,
      })
    }
    expect(run('PAS1001', 'E0001')).toEqual(run('ATK_1', 'ATK_2'))
  })

  it('plays hidden-hand character removal using only a public player target', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[0].character!.hasActionPoint = false
    own.hand = [card('A0004')]
    enemy.hand = [card('PAS1001', 'hidden-character'), card('ATK_1'), card('ATK_2')]
    const report = ai.executeTurn(state, own)
    expect(enemy.graveyard.map((c) => c.uid)).toEqual(['hidden-character'])
    expect(report.decisions[0].action).toEqual({
      type: 'playCard',
      cardUid: 'A0004',
      params: { targetPlayerId: 'human' },
    })
  })

  it('does not spend cards or AP on defensive buffs without consumers', () => {
    const { state, own, ai } = fixture()
    own.deployed[0].character = deployedCard('AG1001', 'caster')
    own.hand = [card('A0008'), card('D0012'), card('C0008')]
    ai.executeTurn(state, own)
    expect(own.hand.map((c) => c.cardId)).toEqual(['A0008', 'D0012', 'C0008'])
    expect(own.deployed[0].character.buffs).toEqual([])
  })

  it('keeps disarm equipment cards whose effect expires before the target can act', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[0].character!.hasActionPoint = false
    enemy.deployed[0].equipment = card('D0016')
    own.hand = [card('A0003')]
    ai.executeTurn(state, own)
    expect(own.hand.map((c) => c.uid)).toEqual(['A0003'])
    expect(enemy.deployed[0].character!.debuffs).toEqual([])
  })

  it('stops immediately after eliminating the final opponent', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[1].character = character('second')
    enemy.deployed[0].character!.currentHp = 1
    ai.executeTurn(state, own)
    expect(state.gameOver).toBe(true)
    expect(own.apUsedThisTurn).toBe(1)
  })

  it('can finish an empty board by direct attack', () => {
    const { state, own, enemy, ai } = fixture()
    enemy.deployed[0].character = null
    enemy.hand = [card('PAS1001', 'reserve')]
    enemy.hp = 2
    ai.executeTurn(state, own)
    expect(enemy.hp).toBe(0)
    expect(state.winner).toBe('ai')
  })

  it('does not reuse a removed attacker in a multiplayer turn', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[0].character = character('fragile', { currentHp: 1, keywords: ['aoeAttack'] })
    enemy.deployed[0].character!.keywords = ['counter']
    state.players.push(player('third'))
    state.players[2].deployed[0].character!.keywords = ['counter']
    expect(() => ai.executeTurn(state, own)).not.toThrow()
  })

  it('reports and blacklists a rejected rules action instead of retrying forever', () => {
    const { state, own, ai, game } = fixture()
    // An isolated boundary fault: the rest of observation, selection and turn execution is real.
    jest.spyOn(game, 'attack').mockReturnValue({ success: false, message: 'rule rejected' })
    const report = ai.executeTurn(state, own)
    expect(report.attempts).toBe(1)
    expect(report.successes).toBe(0)
    expect(report.decisions[0].message).toBe('rule rejected')
    expect(report.stopped).toBe('no-action')
  })

  it('blacklists a successful rules no-op when the observable state does not change', () => {
    const { state, own, ai, game } = fixture()
    jest.spyOn(game, 'attack').mockReturnValue({ success: true, message: 'no-op' })
    const report = ai.executeTurn(state, own)
    expect(report.attempts).toBe(1)
    expect(report.stopped).toBe('no-action')
  })

  it('bounds a real turn with enough AP restoration resources for a long cycle', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[1].character = deployedCard('HHW1001', 'support')
    own.deployed[1].character.attack = 0
    own.hand = Array.from({ length: 100 }, (_, i) => card('ATK_1', `resource-${i}`))
    enemy.deployed[0].character!.currentHp = 1000
    enemy.deployed[0].character!.maxHp = 1000
    const report = ai.executeTurn(state, own)
    expect(report.stopped).toBe('budget')
    expect(report.attempts).toBeLessThanOrEqual(64)
    expect(own.hand.length).toBeGreaterThan(0)
  })
})
