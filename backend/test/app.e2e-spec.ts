import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'

describe('Game API (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('creates a game and rejects an out-of-turn raw attack without spending AP', async () => {
    const created = await request(app.getHttpServer())
      .post('/game/create')
      .send({ playerCount: 1, aiCount: 1 })
      .expect(201)
    const { gameId, state } = created.body
    const human = state.players[0]
    const ai = state.players[1]
    const attack = await request(app.getHttpServer())
      .post(`/game/${gameId}/action`)
      .send({
        type: 'attack',
        playerId: ai.id,
        params: {
          attackerCharUid: ai.deployed[0].character.uid,
          targetPlayerId: human.id,
          targetCharUid: human.deployed[0].character.uid,
        },
      })
      .expect(201)
    expect(attack.body.success).toBe(false)
    expect(attack.body.state.players[0].deployed[0].character.currentHp).toBe(
      human.deployed[0].character.currentHp,
    )
    expect(attack.body.state.players[1].deployed[0].character.hasActionPoint).toBe(true)
  })

  it('runs a bounded AI turn through the HTTP API and exposes the resulting state', async () => {
    const created = await request(app.getHttpServer())
      .post('/game/create')
      .send({ playerCount: 0, aiCount: 2 })
      .expect(201)
    const { gameId } = created.body
    const result = await request(app.getHttpServer())
      .post(`/game/${gameId}/ai-turn`)
      .send({})
      .expect(201)
    expect(result.body.success).toBe(true)
    const state = result.body.state
    if (state.gameOver) expect(state.winner).toBeTruthy()
    else expect(state.currentPlayerIndex).toBe(1)
    const retrieved = await request(app.getHttpServer()).get(`/game/${gameId}/state`).expect(200)
    expect(retrieved.body.state).toEqual(state)
  })

  afterEach(async () => {
    await app.close()
  })
})
