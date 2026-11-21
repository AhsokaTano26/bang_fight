import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { GameState } from '../src/types/game'

async function expectNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }))
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport)
}

// Network fixtures isolate modal navigation and emitted command contracts. Real
// rule resolution/card conservation is covered by the backend service tests.
async function openFixtureGame(
  page: Page,
  request: APIRequestContext,
  cardIds: string[],
  emptyEnemy = false,
) {
  const response = await request.post('/game/create', {
    data: { playerCount: 1, aiCount: 1 },
  })
  const deal = (await response.json()) as {
    success: boolean
    gameId: string
    state: GameState
  }
  const player = deal.state.players.find((player) => !player.isAi)!
  const enemy = deal.state.players.find((player) => player.isAi)!
  player.hand = cardIds.map((cardId, index) => ({
    uid: `ui-card-${index}`,
    cardId,
    suit: 'hearts',
  }))
  deal.state.turnPhase = 'draw'
  if (emptyEnemy)
    enemy.deployed = enemy.deployed.map((slot) => ({
      ...slot,
      character: null,
      equipment: null,
    }))
  await page.route('**/game/**', async (route) => {
    const body = route.request().postDataJSON()
    if (body?.type === 'draw') deal.state.turnPhase = 'action'
    await route.fulfill({ json: deal })
  })
  await page.goto('/#/select')
  await page
    .getByRole('button', { name: '单人对战，1 对 1', exact: true })
    .click()
  await page.getByRole('button', { name: '摸牌', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '结束回合', exact: true }),
  ).toBeEnabled()
  return { player, enemy }
}

test('home opens real modes and starts a playable game', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1487, height: 1058 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`)
  })
  page.on('request', (request) => {
    if (/\/cards\/.*\.png(?:\?|$)/i.test(request.url()))
      errors.push(`Uncompressed card requested: ${request.url()}`)
  })
  await page.goto('/')
  await expect(page).toHaveTitle(/邦邦武斗传/)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png') })
  await page.getByRole('button', { name: '开始对战', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '今天，几个人的牌桌？' }),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('modes-desktop.png') })
  await page
    .getByRole('button', { name: '单人对战，1 对 1', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '第 1 回合' })).toBeVisible()
  await page.getByRole('button', { name: '摸牌', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '结束回合', exact: true }),
  ).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('battle-desktop.png') })
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  const card = page.locator('.hand-cards .card-select').first()
  await expect(card).toBeEnabled()
  await card.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const aiTurn = page.waitForResponse(
    (response) =>
      response.url().endsWith('/ai-turn') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '结束回合', exact: true }).click()
  const next = (await (await aiTurn).json()) as {
    success: boolean
    state: GameState
  }
  expect(next.success).toBe(true)
  if (next.state.gameOver) {
    await expect(
      page.getByRole('dialog', { name: '本局结束', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '再来一局', exact: true }),
    ).toBeEnabled()
  } else {
    expect(next.state.players[next.state.currentPlayerIndex]!.isAi).toBe(false)
    await expect(
      page.getByRole('button', { name: '摸牌', exact: true }),
    ).toBeEnabled()
  }
  await expectNoOverflow(page)
  expect(errors).toEqual([])
})

test('catalog inspection supports keyboard, focus restoration and distinct mushroom effects', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1487, height: 1058 })
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error')
      warnings.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      warnings.push(`${response.status()} ${response.url()}`)
  })
  await page.goto('/#/gallery')
  await expect(
    page.getByRole('heading', { name: '卡牌图鉴', exact: true }),
  ).toBeVisible()
  await page
    .locator('.catalog-card img')
    .first()
    .evaluate((image: HTMLImageElement) => image.decode())
  await page.screenshot({ path: testInfo.outputPath('catalog-desktop.png') })
  const search = page.getByRole('searchbox')
  await search.fill('AM1005')
  const card = page.getByRole('button', { name: /查看元祖祥子，AM1005/ })
  await card.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '元祖祥子', exact: true })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('heading', { name: '我来成为神明' }),
  ).toBeVisible()
  await dialog
    .locator('img')
    .evaluate((image: HTMLImageElement) => image.decode())
  await page.screenshot({ path: testInfo.outputPath('card-details.png') })
  await expect(dialog.locator('img')).toHaveAttribute(
    'src',
    /\/v1\.9\/角色\/AM1005\.webp$/,
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(card).toBeFocused()
  await page.getByRole('tab', { name: /道具与即时/ }).click()
  await page.getByRole('searchbox').fill('蘑菇')
  await expect(page.locator('.catalog-card')).toHaveCount(4)
  await page.getByRole('button', { name: /C1003的卡牌详情/ }).click()
  await expect(page.getByRole('dialog')).toContainText('2T沉默')
  await page.keyboard.press('Escape')
  await page.getByRole('searchbox').fill('不存在的卡牌abc123')
  await expect(
    page.getByRole('heading', { name: '没有找到匹配的卡牌' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '重置搜索与筛选' }).click()
  await expect(page.locator('.catalog-card')).toHaveCount(74)
  expect(warnings).toEqual([])
})

test('rules navigation selects one tab and returns to the collection', async ({
  page,
}) => {
  await page.goto('/#/gallery')
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '规则', exact: true })
    .click()
  await expect(
    page.getByRole('tab', { name: '规则', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('heading', { name: '一个回合，五个阶段' }),
  ).toBeVisible()
  await expect(page.locator('.header-nav [aria-current="page"]')).toHaveCount(1)
  await page.getByRole('tab', { name: '角色 50', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.catalog-card')).toHaveCount(50)
})

test('changing mode during a pending creation keeps the latest game', async ({
  page,
}) => {
  let releaseFirst!: () => void
  let signalHeld!: () => void
  let signalSettled!: () => void
  const held = new Promise<void>((resolve) => {
    signalHeld = resolve
  })
  const release = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const settled = new Promise<void>((resolve) => {
    signalSettled = resolve
  })
  await page.route('**/game/create', async (route) => {
    const response = await route.fetch()
    if (route.request().postDataJSON().aiCount === 1) {
      signalHeld()
      await release
      await route.fulfill({ response }).catch(() => {}) // The old request may have been aborted.
      signalSettled()
    } else await route.fulfill({ response })
  })
  await page.goto('/#/select')
  await page
    .getByRole('button', { name: '单人对战，1 对 1', exact: true })
    .click()
  await held
  try {
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '对战', exact: true })
      .click()
    await page
      .getByRole('button', { name: '四人混战，1 对 3', exact: true })
      .click()
    await expect(page.locator('.ai-area')).toHaveCount(3)
  } finally {
    releaseFirst()
  }
  await settled
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await expect(page.locator('.ai-area')).toHaveCount(3)
})

test('recovery and replenish Back buttons return to their own choices', async ({
  page,
  request,
}) => {
  await openFixtureGame(page, request, [
    'RECOVERY_1',
    'BIG_RECOVERY_1',
    'REPLENISH_1',
  ])
  await page.getByRole('button', { name: '选择回复', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /回复玩家/ }).click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: '确认使用', exact: true }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /回复角色/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '选择回复大', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /回复角色/ }).click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: '确认使用', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '选择补充', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /抽牌/ }).click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await dialog.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /招揽角色/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /回复玩家/ })).toHaveCount(0)
})

test('strategy choices send public player and distinct character targets', async ({
  page,
  request,
}) => {
  const { player, enemy } = await openFixtureGame(page, request, [
    'A0004',
    'C0012',
  ])
  await page
    .getByRole('button', { name: '选择财团B的阴谋', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('选择目标玩家', { exact: true })).toBeVisible()
  await expect(dialog.locator('.select-card')).toHaveCount(2)
  await expect(dialog.locator('.select-card img')).toHaveCount(0)
  await dialog.locator('.select-card').last().click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  let command = page.waitForRequest(
    (request) =>
      request.url().endsWith('/action') &&
      request.postDataJSON()?.type === 'playCard',
  )
  await dialog.getByRole('button', { name: '确认使用', exact: true }).click()
  let payload = (await command).postDataJSON()
  expect(payload.params.params).toEqual({ targetPlayerId: enemy.id })
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: '选择做了！', exact: true }).click()
  const firstUid = player.deployed.find((slot) => slot.character)!.character!
    .uid
  const secondUid = enemy.deployed.find((slot) => slot.character)!.character!
    .uid
  await dialog.locator('.select-card').first().click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(dialog.locator('.select-card').first()).toBeDisabled()
  await dialog
    .locator('.target-group')
    .last()
    .locator('.select-card')
    .first()
    .click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await dialog.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: '下一步', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: '下一步', exact: true }),
  ).toBeDisabled()
  await expect(dialog.locator('.select-card').first()).toBeEnabled()
  await dialog.locator('.select-card').first().click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await dialog
    .locator('.target-group')
    .last()
    .locator('.select-card')
    .first()
    .click()
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  command = page.waitForRequest(
    (request) =>
      request.url().endsWith('/action') &&
      request.postDataJSON()?.type === 'playCard',
  )
  await dialog.getByRole('button', { name: '确认使用', exact: true }).click()
  payload = (await command).postDataJSON()
  expect(payload.params.params).toEqual({
    targetCharUid1: firstUid,
    targetCharUid2: secondUid,
  })
})

for (const direct of [false, true]) {
  test(`hand attack emits playCard with ${direct ? 'player' : 'character'} target and a complete actor`, async ({
    page,
    request,
  }) => {
    const { player, enemy } = await openFixtureGame(
      page,
      request,
      ['ATK_1'],
      direct,
    )
    await page.getByRole('button', { name: '选择肘击', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('.select-card').first().click()
    await dialog.getByRole('button', { name: '下一步', exact: true }).click()
    await expect(
      dialog.getByRole('button', { name: '下一步', exact: true }),
    ).toBeDisabled()
    await dialog.locator('.select-card').first().click()
    await dialog.getByRole('button', { name: '下一步', exact: true }).click()
    const command = page.waitForRequest(
      (request) =>
        request.url().endsWith('/action') &&
        request.postDataJSON()?.type === 'playCard',
    )
    await dialog.getByRole('button', { name: '确认使用', exact: true }).click()
    const body = (await command).postDataJSON()
    expect(body.params.cardUid).toBe('ui-card-0')
    expect(body.params.params.attackerCharUid).toBe(
      player.deployed.find((slot) => slot.character)!.character!.uid,
    )
    expect(body.params.params.targetPlayerId).toBe(enemy.id)
    if (direct) expect(body.params.params.targetCharUid).toBeUndefined()
    else
      expect(body.params.params.targetCharUid).toBe(
        enemy.deployed.find((slot) => slot.character)!.character!.uid,
      )
  })
}

for (const width of [320, 390, 768]) {
  test(`small-screen battle keeps overflow within the board and hand rails at ${width}px`, async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await openFixtureGame(page, request, [
      'ATK_1',
      'ARMOR_1',
      'REPLENISH_1',
      'RECOVERY_1',
      'A0001',
    ])
    await expectNoOverflow(page)
    await expect(page.locator('.deploy-slot')).toHaveCount(10)
    await page.screenshot({ path: testInfo.outputPath(`battle-${width}.png`) })
    await page.locator('.hand-cards .card-inspect').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expectNoOverflow(page)
  })
}

for (const width of [320, 390, 768, 1280]) {
  test(`entry and catalog fit a ${width}px viewport`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 })
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: '开始对战', exact: true }),
    ).toBeVisible()
    await expectNoOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) })
    await page.getByRole('button', { name: '浏览卡牌', exact: true }).click()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await expectNoOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`) })
    await page.locator('.catalog-card').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoOverflow(page)
    await page.keyboard.press('Escape')
  })
}

test('home, catalog and inspection have no automatically detectable WCAG AA issues', async ({
  page,
}) => {
  for (const route of ['/', '/#/gallery']) {
    await page.goto(route)
    await expect(page.getByRole('main')).toBeVisible()
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(result.violations).toEqual([])
  }
  await page.locator('.catalog-card').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const dialogResult = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(dialogResult.violations).toEqual([])
})
