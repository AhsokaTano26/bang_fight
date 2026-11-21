// Run from backend/: node -r ts-node/register test/ai-smoke.cjs
// Deterministic deck/dice seeds; wall-clock log timestamps are not compared.
const assert = require('node:assert/strict')
const { performance } = require('node:perf_hooks')
const { fixture } = require('../src/game/ai/test-fixtures')
const { CHARACTER_CARDS } = require('../src/game/character-data')

function seededRandom(initial) {
  let seed = initial
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

function cardsInState(state) {
  return [
    ...state.characterPool,
    ...state.actionDeck,
    ...state.strategyDeck,
    ...state.players.flatMap((p) => [
      ...p.hand,
      ...p.discardPile,
      ...p.graveyard,
      ...p.judgmentZone,
      ...p.deployed.flatMap((s) => [s.character, s.equipment].filter(Boolean)),
    ]),
  ]
}

function assertCardConservation(state, originalUids) {
  const counts = new Map()
  for (const card of cardsInState(state)) {
    if (originalUids.has(card.uid)) counts.set(card.uid, (counts.get(card.uid) ?? 0) + 1)
  }
  assert.equal(counts.size, originalUids.size, 'an original card was lost')
  for (const count of counts.values()) assert.equal(count, 1, 'an original card was duplicated')
}

const originalRandom = Math.random
const results = []
const failureReasons = {}
const started = performance.now()
try {
  for (const players of [2, 3, 4]) {
    for (let seed = 1; seed <= 8; seed++) {
      Math.random = seededRandom(seed)
      const { game, ai, deck } = fixture()
      assert.equal(CHARACTER_CARDS.length, 20)
      assert.equal(deck.actionCardDefs.length, 52)
      assert.equal(deck.strategyCardDefs.length, 76)
      const state = game.createGame(0, players)
      const originalUids = new Set(cardsInState(state).map((c) => c.uid))
      let turns = 0,
        attempts = 0,
        maxAttempts = 0,
        failures = 0
      while (!state.gameOver && turns < 150) {
        const current = state.players[state.currentPlayerIndex]
        if (current.isAlive) {
          game.startTurn(state)
          game.drawPhase(state)
          const report = ai.executeTurn(state, current)
          assert.ok(report.attempts <= 64, 'AI exceeded its per-turn budget')
          assert.ok(report.decisions.every((d) => Number.isFinite(d.utility) && d.utility > 0))
          attempts += report.attempts
          maxAttempts = Math.max(maxAttempts, report.attempts)
          failures += report.attempts - report.successes
          for (const decision of report.decisions.filter((d) => !d.success)) {
            failureReasons[decision.message] = (failureReasons[decision.message] ?? 0) + 1
          }
        }
        turns++
        if (!state.gameOver) game.endTurn(state)
        assertCardConservation(state, originalUids)
      }
      assert.ok(state.gameOver, `game capped at 150 turns: players=${players}, seed=${seed}`)
      results.push({
        players,
        seed,
        turns,
        attempts,
        maxAttempts,
        failures,
        winner: state.winner,
        capped: !state.gameOver,
      })
    }
  }
} finally {
  Math.random = originalRandom
}

for (const message of Object.keys(failureReasons)) {
  assert.equal(message, '目标手牌中没有可送入休息室的角色', `unexpected rule rejection: ${message}`)
}

console.log(
  JSON.stringify(
    {
      games: results.length,
      completed: results.filter((r) => !r.capped).length,
      totalAttempts: results.reduce((n, r) => n + r.attempts, 0),
      maxAttempts: Math.max(...results.map((r) => r.maxAttempts)),
      failures: results.reduce((n, r) => n + r.failures, 0),
      failureReasons,
      originalCardUidsConserved: true,
      elapsedMs: Math.round(performance.now() - started),
      results,
    },
    null,
    2,
  ),
)
