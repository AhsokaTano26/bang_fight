import { enumerateActions } from './actions'
import { attackOutcomes } from './combat-model'
import { observe } from './observation'
import { rankActions, scoreAction } from './scoring'
import { card, character, deployedCard, fixture, player } from './test-fixtures'

describe('observable utility core', () => {
  it('returns an immutable public snapshot without enemy hand identities or deck order', () => {
    const { state, own, enemy } = fixture()
    enemy.hand = [card('PAS1001', 'secret-card')]
    state.actionDeck = [card('E0001', 'secret-deck')]
    const view = observe(state, own.id)!
    expect(JSON.stringify(view)).not.toContain('secret')
    expect(view.enemies[0].handCount).toBe(1)
    view.own.deployed[0].character!.currentHp = 1
    expect(own.deployed[0].character!.currentHp).toBe(10)
  })

  it('enumerates complete direct-player attack-card parameters', () => {
    const { state, own, enemy, deck } = fixture()
    enemy.deployed[0].character = null
    own.hand = [card('ARMOR_1')]
    const actions = enumerateActions(observe(state, own.id)!, {
      actions: deck.actionCardDefs,
      strategies: deck.strategyCardDefs,
    })
    expect(actions).toContainEqual({
      type: 'playCard',
      cardUid: 'ARMOR_1',
      params: {
        attackerCharUid: 'ai-char',
        targetPlayerId: 'human',
      },
    })
  })

  it('enumerates two enemy weakening targets across different owners', () => {
    const { state, own, enemy, deck } = fixture()
    own.hand = [card('C0012')]
    enemy.deployed[1].character = character('second-enemy')
    state.players.push(player('third'))
    const actions = enumerateActions(observe(state, own.id)!, {
      actions: deck.actionCardDefs,
      strategies: deck.strategyCardDefs,
    }).filter((a) => a.type === 'playCard')
    expect(actions).toContainEqual({
      type: 'playCard',
      cardUid: 'C0012',
      params: {
        targetCharUid1: 'human-char',
        targetCharUid2: 'third-char',
      },
    })
    for (const action of actions) {
      if (action.type !== 'playCard') continue
      expect(action.params.targetCharUid1).not.toBe(action.params.targetCharUid2)
      expect(action.params.targetCharUid2).toBeTruthy()
      for (const uid of [action.params.targetCharUid1, action.params.targetCharUid2]) {
        expect(
          state.players
            .filter((p) => p.id !== own.id)
            .some((p) => p.deployed.some((s) => s.character?.uid === uid)),
        ).toBe(true)
      }
    }
  })

  it('predicts expected critical damage without reading or changing randomness', () => {
    const attacker = character('attacker', {
      attack: 4,
      buffs: [{ type: 'critOnAttack', value: 1, source: 'test', remainingTurns: 1 }],
    })
    const target = character('target', { armor: 2 })
    const outcomes = attackOutcomes(attacker, target, false)
    expect(outcomes.map((o) => [o.probability, o.damage])).toEqual([
      [0.5, 2],
      [0.5, 6],
    ])
    expect(target.armor).toBe(2)
  })

  it('models a counter after near-death recovery rather than inventing immunity', () => {
    const target = character('target', {
      currentHp: 4,
      keywords: ['counter'],
      buffs: [{ type: 'nearDeathRecover', value: 1, source: 'test', remainingTurns: -1 }],
    })
    expect(attackOutcomes(character('attacker'), target, false)[0].counterProbability).toBe(1)
  })

  it('values near-death recovery using expected net HP rather than the initial hit', () => {
    const target = character('target', {
      currentHp: 2,
      maxHp: 10,
      buffs: [{ type: 'nearDeathRecover', value: 1, source: 'test', remainingTurns: -1 }],
    })
    const outcomes = attackOutcomes(character('attacker', { attack: 1 }), target, false)
    expect(outcomes.reduce((n, o) => n + o.probability * o.damage, 0)).toBeCloseTo(-0.5)
  })

  it('uses net earth-store HP loss while retaining the raw hit for spread', () => {
    const target = character('target', { currentHp: 4, keywords: ['earthStore'] })
    const outcome = attackOutcomes(character('attacker', { attack: 100 }), target, false)[0]
    expect(outcome.damage).toBe(3)
    expect(outcome.spreadDamage).toBe(100)
    expect(outcome.retired).toBe(false)
  })

  it('values a forced retirement as the entire remaining HP loss', () => {
    const attacker = character('attacker', {
      attack: 1,
      buffs: [{ type: 'forceRetireOnHit', value: 1, remainingTurns: -1, source: 'test' }],
    })
    expect(attackOutcomes(attacker, character('target'), false)[0].damage).toBe(10)
  })

  it('breaks equal utility ties independently of hand ordering', () => {
    const { state, own, deck } = fixture()
    own.hand = [card('PAS1001', 'z'), card('PAS1001', 'a')]
    const catalog = { actions: deck.actionCardDefs, strategies: deck.strategyCardDefs }
    const first = rankActions(observe(state, own.id)!, catalog)[0]
    own.hand.reverse()
    expect(rankActions(observe(state, own.id)!, catalog)[0]).toEqual(first)
    expect(first.action).toMatchObject({ type: 'deploy', cardUid: 'a' })
  })

  it('prefers a safe target to a fatal counterattack', () => {
    const { state, own, enemy, deck } = fixture()
    own.deployed[0].character!.currentHp = 1
    enemy.deployed[0].character = character('counter', { currentHp: 4, keywords: ['counter'] })
    enemy.deployed[4].character = character('safe', { currentHp: 6 })
    const first = rankActions(observe(state, own.id)!, {
      actions: deck.actionCardDefs,
      strategies: deck.strategyCardDefs,
    })[0]
    expect(first.action).toMatchObject({ type: 'attack', targetCharUid: 'safe' })
  })

  it('replaces a spent fragile character with a stronger reserve on a full board', () => {
    const { state, own, ai } = fixture()
    own.deployed.forEach((slot, i) => {
      slot.character = character(`weak-${i}`, { currentHp: 1, attack: 0, hasActionPoint: false })
    })
    own.hand = [card('PAS1001', 'replacement')]
    ai.executeTurn(state, own)
    expect(own.deployed.some((s) => s.character?.uid === 'replacement')).toBe(true)
    expect(own.replacementCountThisTurn).toBe(1)
  })

  it('activates a real drawing equipment effect when its AP has no attack value', () => {
    const { state, own, enemy, ai } = fixture()
    own.deployed[0].equipment = card('C0014')
    own.deployed[0].character!.buffs.push({
      type: 'conditionalBonus',
      value: 0,
      remainingTurns: -1,
      source: 'C0014:scry5pick2',
    })
    enemy.deployed[0].character!.keywords = ['immunity']
    state.actionDeck = [card('ATK_1'), card('ATK_2'), card('ATK_3')]
    ai.executeTurn(state, own)
    expect(own.hand).toHaveLength(2)
    expect(own.deployed[0].character!.hasActionPoint).toBe(false)
  })

  it('does not invent AP restoration for the sacrifice-heal handler', () => {
    const { state, own, deck } = fixture()
    own.deployed[0].character = deployedCard('ROS1003', 'caster')
    own.deployed[0].character.currentHp = 5
    own.deployed[0].character.attack = 0
    own.deployed[1].character = character('ally', {
      cardId: 'summon-test',
      state: 'nearDeath',
      currentHp: 1,
      maxHp: 10,
      hasActionPoint: false,
    })
    expect(
      scoreAction(
        observe(state, own.id)!,
        { actions: deck.actionCardDefs, strategies: deck.strategyCardDefs },
        {
          type: 'useSkill',
          charUid: 'caster',
          params: { targetCharUid: 'ally' },
        },
      ),
    ).toBe(5)
  })
})
