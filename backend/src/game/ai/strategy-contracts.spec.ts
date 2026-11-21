import { card, character, fixture } from './test-fixtures'

describe('strategy target contracts through real card resolution', () => {
  it('chooses an eligible undeployed character internally and moves it to the graveyard', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('A0004')]
    enemy.hand = [card('ATK_1'), card('PAS1001', 'hidden-character')]
    expect(game.playCard(state, 'ai', 'A0004', { targetPlayerId: 'human' }).success).toBe(true)
    expect(enemy.hand.map((c) => c.uid)).toEqual(['ATK_1'])
    expect(enemy.graveyard.map((c) => c.uid)).toEqual(['hidden-character'])
    expect(enemy.discardPile).toEqual([])
    expect(own.discardPile.map((c) => c.uid)).toEqual(['A0004'])
    const uids = [
      ...own.hand,
      ...own.discardPile,
      ...enemy.hand,
      ...enemy.graveyard,
      ...enemy.discardPile,
    ].map((c) => c.uid)
    expect(uids.sort()).toEqual(['A0004', 'ATK_1', 'hidden-character'])
  })

  it.each([{}, { targetCardUid: 'ATK_1' }, { targetCardUid: 'missing' }])(
    'rejects a hand without an eligible character: %o',
    (extra) => {
      const { state, own, enemy, game } = fixture()
      own.hand = [card('A0004')]
      enemy.hand = [card('ATK_1')]
      expect(
        game.playCard(state, 'ai', 'A0004', { targetPlayerId: 'human', ...extra }).success,
      ).toBe(false)
      expect(own.hand.map((c) => c.uid)).toEqual(['A0004'])
      expect(enemy.hand.map((c) => c.uid)).toEqual(['ATK_1'])
    },
  )

  it.each([
    {},
    { targetCharUid1: 'human-char' },
    { targetCharUid1: 'human-char', targetCharUid2: 'human-char' },
    { targetCharUid1: 'human-char', targetCharUid2: 'missing' },
  ])('rejects incomplete or invalid weakening pairs atomically: %o', (params) => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('C0012')]
    expect(
      game.playCard(state, 'ai', 'C0012', { targetPlayerId: 'human', ...params }).success,
    ).toBe(false)
    expect(own.hand.map((c) => c.uid)).toEqual(['C0012'])
    expect(enemy.deployed[0].character!.debuffs).toEqual([])
  })

  it('weakens two distinct deployed characters across owners using only public UIDs', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('C0012')]
    expect(
      game.playCard(state, 'ai', 'C0012', {
        targetCharUid1: 'ai-char',
        targetCharUid2: 'human-char',
      }).success,
    ).toBe(true)
    expect(own.deployed[0].character!.debuffs).toMatchObject([{ type: 'weaken', value: 2 }])
    expect(enemy.deployed[0].character!.debuffs).toMatchObject([{ type: 'weaken', value: 2 }])
    expect(own.discardPile.map((c) => c.uid)).toEqual(['C0012'])
  })

  it('supports the legacy same-player weakening pair payload', () => {
    const { state, own, enemy, game } = fixture()
    enemy.deployed[1].character = character('second')
    own.hand = [card('C0012')]
    expect(
      game.playCard(state, 'ai', 'C0012', {
        targetPlayerId: 'human',
        targetCharUid1: 'human-char',
        targetCharUid2: 'second',
      }).success,
    ).toBe(true)
    expect(enemy.deployed[1].character.debuffs).toMatchObject([{ type: 'weaken', value: 2 }])
  })
})
