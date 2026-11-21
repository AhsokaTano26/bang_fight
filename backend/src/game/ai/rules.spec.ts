import { GameController } from '../game.controller'
import { card, deployedCard, fixture } from './test-fixtures'

describe('shared action rules with real services', () => {
  afterEach(() => jest.restoreAllMocks())

  it.each(['draw', 'discard', 'ended'] as const)('rejects raw attacks in %s phase', (phase) => {
    const { state, combat, enemy } = fixture()
    state.turnPhase = phase
    expect(combat.resolveAttack(state, 'ai', 'ai-char', 'human', 'human-char', false).success).toBe(
      false,
    )
    expect(enemy.deployed[0].character!.currentHp).toBe(10)
  })

  it('rejects skipAction through both controller attack routes', () => {
    const { state, own, enemy, store, game, combat, ai } = fixture()
    own.deployed[0].character!.debuffs.push({
      type: 'skipAction',
      value: 1,
      remainingTurns: 1,
      source: 'test',
    })
    store.create('test', state)
    const controller = new GameController(game, store, combat, ai)
    expect(
      controller.submitAction('test', {
        type: 'attack',
        playerId: 'ai',
        params: {
          attackerCharUid: 'ai-char',
          targetPlayerId: 'human',
          targetCharUid: 'human-char',
        },
      }).success,
    ).toBe(false)
    enemy.deployed[0].character = null
    expect(
      controller.submitAction('test', {
        type: 'directAttack',
        playerId: 'ai',
        params: {
          attackerCharUid: 'ai-char',
          targetPlayerId: 'human',
        },
      }).success,
    ).toBe(false)
    expect(enemy.hp).toBe(20)
  })

  it('rejects wrong-turn, self, dead-player and near-death attackers', () => {
    const { state, own, enemy, combat } = fixture()
    expect(combat.resolveAttack(state, 'human', 'human-char', 'ai', 'ai-char', false).success).toBe(
      false,
    )
    expect(combat.resolveAttack(state, 'ai', 'ai-char', 'ai', 'ai-char', false).success).toBe(false)
    own.deployed[0].character!.state = 'nearDeath'
    expect(combat.resolveAttack(state, 'ai', 'ai-char', 'human', 'human-char', false).success).toBe(
      false,
    )
    own.deployed[0].character!.state = 'normal'
    enemy.isAlive = false
    expect(combat.resolveAttack(state, 'ai', 'ai-char', 'human', 'human-char', false).success).toBe(
      false,
    )
  })

  it('keeps AP when a skill cannot find its required target', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character = deployedCard('PPP1004', 'caster')
    expect(game.useSkill(state, 'ai', 'caster', { targetCharUid: 'missing' }).success).toBe(false)
    expect(own.deployed[0].character.hasActionPoint).toBe(true)
    expect(own.apUsedThisTurn).toBe(0)
  })

  it('validates turn and caster state before a skill mutates anything', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character = deployedCard('AG1005', 'caster')
    state.turnPhase = 'draw'
    expect(game.useSkill(state, 'ai', 'caster', {}).success).toBe(false)
    expect(own.deployed[0].character.hasActionPoint).toBe(true)
  })

  it('reserves a strategy by uid before a handler mutates the hand', () => {
    const { state, own, game } = fixture()
    own.hand = [card('A0005'), card('E0001'), card('ATK_1')]
    expect(
      game.playCard(state, 'ai', 'A0005', { targetPlayerId: 'human', targetCharUid: 'human-char' })
        .success,
    ).toBe(true)
    expect(own.hand.map((c) => c.uid)).toEqual(['ATK_1'])
    expect(own.discardPile.map((c) => c.uid).sort()).toEqual(['A0005', 'E0001'])
  })

  it('does not duplicate equipped cards into discard', () => {
    const { state, own, game, deck } = fixture()
    const def = deck.strategyCardDefs.find((d) => d.strategyType === 'deployable')!
    own.hand = [card(def.id, 'equipment')]
    expect(game.playCard(state, 'ai', 'equipment', { targetCharUid: 'ai-char' }).success).toBe(true)
    expect(own.deployed[0].equipment!.uid).toBe('equipment')
    expect(own.hand).toHaveLength(0)
    expect(own.discardPile).toHaveLength(0)
  })

  it('restores an unsuccessful card to its hand position', () => {
    const { state, own, game } = fixture()
    own.hand = [card('ATK_1'), card('D0009'), card('ATK_2')]
    expect(game.playCard(state, 'ai', 'D0009', {}).success).toBe(false)
    expect(own.hand.map((c) => c.uid)).toEqual(['ATK_1', 'D0009', 'ATK_2'])
  })

  it('consumes an attack card when targeting an undefended player', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('ATK_1')]
    enemy.deployed[0].character = null
    enemy.hand = [card('PAS1001', 'reserve')]
    expect(
      game.playCard(state, 'ai', 'ATK_1', { attackerCharUid: 'ai-char', targetPlayerId: 'human' })
        .success,
    ).toBe(true)
    expect(enemy.hp).toBe(18)
    expect(own.hand).toHaveLength(0)
    expect(own.discardPile.map((c) => c.uid)).toEqual(['ATK_1'])
  })

  it('rejects direct-player attack cards while an opponent has deployed characters', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('ARMOR_1')]
    expect(
      game.playCard(state, 'ai', 'ARMOR_1', { attackerCharUid: 'ai-char', targetPlayerId: 'human' })
        .success,
    ).toBe(false)
    expect(enemy.hp).toBe(20)
    expect(own.hand).toHaveLength(1)
    expect(own.deployed[0].character!.hasActionPoint).toBe(true)
  })

  it('preserves AP when drawing equipment fails because the deck is empty', () => {
    const { state, own, game } = fixture()
    own.deployed[0].equipment = card('C0014')
    own.deployed[0].character!.buffs.push({
      type: 'conditionalBonus',
      value: 0,
      remainingTurns: -1,
      source: 'C0014:scry5pick2',
    })
    expect(game.useEquipment(state, 'ai', 'ai-char', {}).success).toBe(false)
    expect(own.deployed[0].character!.hasActionPoint).toBe(true)
  })

  it('preserves a skill discard cost when AP cannot be restored to any character', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character = deployedCard('HHW1001', 'support')
    own.hand = [card('ATK_1')]
    expect(game.useSkill(state, 'ai', 'support', { targetCharUid: 'missing' }).success).toBe(false)
    expect(own.hand.map((c) => c.uid)).toEqual(['ATK_1'])
  })

  it('keeps a successful AP-restoration discard in the discard pile', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character = deployedCard('HHW1001', 'support')
    own.deployed[1].character = deployedCard('PAS1001', 'spent')
    own.deployed[1].character.hasActionPoint = false
    own.hand = [card('ATK_1')]
    expect(game.useSkill(state, 'ai', 'support', { targetCharUid: 'spent' }).success).toBe(true)
    expect(own.discardPile.map((c) => c.uid)).toEqual(['ATK_1'])
  })

  it('does not spend a disabled character AP when another character can pay for block', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character!.debuffs.push({
      type: 'loseAbility',
      value: 1,
      remainingTurns: 1,
      source: 'test',
    })
    own.deployed[1].character = deployedCard('PAS1001', 'available')
    own.hand = [card('BIG_BLOCK_1')]
    expect(game.playCard(state, 'ai', 'BIG_BLOCK_1', {}).success).toBe(true)
    expect(own.deployed[0].character!.hasActionPoint).toBe(true)
    expect(own.deployed[1].character.hasActionPoint).toBe(false)
  })

  it('publishes an immediate human-route victory after the final character retires', () => {
    const { state, enemy, store, game, combat, ai } = fixture()
    enemy.deployed[0].character!.currentHp = 1
    store.create('test', state)
    const result = new GameController(game, store, combat, ai).submitAction('test', {
      type: 'attack',
      playerId: 'ai',
      params: { attackerCharUid: 'ai-char', targetPlayerId: 'human', targetCharUid: 'human-char' },
    })
    expect(result.state.gameOver).toBe(true)
    expect(state.winner).toBe('ai')
  })

  it('does not advance the turn after an AI wins inside its action loop', () => {
    const { state, enemy, store, game, combat, ai } = fixture()
    enemy.deployed[0].character!.currentHp = 1
    store.create('test', state)
    new GameController(game, store, combat, ai).aiTurn('test')
    expect(state.gameOver).toBe(true)
    expect(state.currentPlayerIndex).toBe(0)
    expect(state.turnPhase).toBe('action')
  })

  it('keeps permanent equipment piercing through the next turn and still pierces armor', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('C0007')]
    enemy.deployed[0].character!.armor = 10
    expect(game.playCard(state, 'ai', 'C0007', { targetCharUid: 'ai-char' }).success).toBe(true)
    game.startTurn(state)
    game.drawPhase(state)
    expect(game.attack(state, 'ai', 'ai-char', 'human', 'human-char').success).toBe(true)
    expect(enemy.deployed[0].character!.currentHp).toBe(8)
    expect(enemy.deployed[0].character!.armor).toBe(10)
  })

  it('retains permanent debuffs while expiring finite buffs and debuffs', () => {
    const { state, own, game } = fixture()
    own.deployed[0].character!.buffs.push({
      type: 'attackBoost',
      value: 3,
      remainingTurns: 1,
      source: 'finite',
    })
    own.deployed[0].character!.debuffs.push(
      { type: 'weaken', value: 1, remainingTurns: -1, source: 'permanent' },
      { type: 'disarm', value: 1, remainingTurns: 1, source: 'finite' },
    )
    game.startTurn(state)
    expect(own.deployed[0].character!.buffs).toEqual([])
    expect(own.deployed[0].character!.debuffs).toMatchObject([
      { type: 'weaken', remainingTurns: -1 },
    ])
  })

  it('moves a stolen excess character out of its previous graveyard exactly once', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
    const { state, own, enemy, game } = fixture()
    own.hand = [card('AG1001'), card('AG1002'), card('AG1003'), card('AG1004')]
    enemy.deployed[0].character!.buffs.push({
      type: 'stealDiscard',
      value: 1,
      remainingTurns: 1,
      source: 'test',
    })
    game.endTurn(state)
    expect(enemy.hand.map((c) => c.uid)).toEqual(['AG1001'])
    expect(own.graveyard).toEqual([])
    expect(own.hand.map((c) => c.uid)).toEqual(['AG1002', 'AG1003', 'AG1004'])
  })

  it('does not reuse an already consumed steal-discard marker', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('BIG_RECOVERY_1'), card('BIG_RECOVERY_2')]
    enemy.deployed[0].character!.buffs.push({
      type: 'stealDiscard',
      value: 1,
      remainingTurns: 1,
      source: 'test',
    })
    expect(game.playCard(state, 'ai', 'BIG_RECOVERY_1', {}).success).toBe(true)
    expect(game.playCard(state, 'ai', 'BIG_RECOVERY_2', {}).success).toBe(true)
    expect(enemy.hand.map((c) => c.uid)).toEqual(['BIG_RECOVERY_1'])
    expect(own.discardPile.map((c) => c.uid)).toEqual(['BIG_RECOVERY_2'])
  })

  it('does not resurrect a consumed discard-steal marker after its next turn starts', () => {
    const { state, own, enemy, game } = fixture()
    own.hand = [card('BIG_RECOVERY_1'), card('BIG_RECOVERY_2')]
    enemy.deployed[0].character!.buffs.push({
      type: 'stealDiscard',
      value: 1,
      remainingTurns: 1,
      source: 'test',
    })
    expect(game.playCard(state, 'ai', 'BIG_RECOVERY_1', {}).success).toBe(true)
    game.endTurn(state)
    game.startTurn(state)
    game.drawPhase(state)
    game.endTurn(state)
    game.startTurn(state)
    game.drawPhase(state)
    expect(game.playCard(state, 'ai', 'BIG_RECOVERY_2', {}).success).toBe(true)
    expect(enemy.hand.map((c) => c.uid)).toEqual(['BIG_RECOVERY_1'])
    expect(own.discardPile.map((c) => c.uid)).toEqual(['BIG_RECOVERY_2'])
  })
})
