import { fixture } from './test-fixtures'

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

function runGame(seed: number) {
  jest.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
  const { game, ai } = fixture()
  const state = game.createGame(0, 2)
  let turns = 0
  let attempts = 0
  while (!state.gameOver && turns < 100) {
    game.startTurn(state)
    game.drawPhase(state)
    const report = ai.executeTurn(state, state.players[state.currentPlayerIndex])
    expect(report.attempts).toBeLessThanOrEqual(64)
    expect(report.decisions.every((d) => Number.isFinite(d.utility) && d.utility > 0)).toBe(true)
    attempts += report.attempts
    turns++
    if (!state.gameOver) game.endTurn(state)
  }
  jest.restoreAllMocks()
  return {
    winner: state.winner,
    turns,
    attempts,
    gameOver: state.gameOver,
    board: state.players.map((p) => ({
      hp: p.hp,
      alive: p.isAlive,
      deployed: p.deployed.map(
        (s) =>
          s.character && {
            cardId: s.character.cardId,
            hp: s.character.currentHp,
            attack: s.character.attack,
          },
      ),
      hand: p.hand.map((c) => c.cardId),
    })),
  }
}

describe('bounded seeded AI games', () => {
  afterEach(() => jest.restoreAllMocks())

  it('repeats the same decisions and outcomes for the same dice/deck seed', () => {
    expect(runGame(42)).toEqual(runGame(42))
  })

  it('runs eight games without invalid scores or unbounded turns', () => {
    const results = Array.from({ length: 8 }, (_, i) => runGame(i + 1))
    expect(results.some((r) => r.gameOver)).toBe(true)
    expect(
      results.every((r) => r.turns <= 100 && r.board.every((p) => Number.isFinite(p.hp))),
    ).toBe(true)
  })
})
