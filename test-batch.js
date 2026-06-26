// ============================================================
// Batch AI Battle Test Script v2
// Tracks card usage from API responses, not just log text
// Run: node test-batch.js [gameCount] [maxTurns]
// ============================================================

const BASE = 'http://localhost:3000'
const GAME_COUNT = parseInt(process.argv[2] || '50')
const MAX_TURNS = parseInt(process.argv[3] || '80')

// Track card usage by comparing hand sizes before/after AI turns
// and by checking state changes

async function createGame() {
  const res = await fetch(`${BASE}/game/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerCount: 0, aiCount: 2 }),
  })
  return res.json()
}

async function aiTurn(gameId) {
  const res = await fetch(`${BASE}/game/${gameId}/ai-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  return res.json()
}

async function getState(gameId) {
  const res = await fetch(`${BASE}/game/${gameId}/state`)
  return res.json()
}

async function runOneBattle(gameIndex) {
  const { gameId } = await createGame()
  const allLogs = []
  let turns = 0
  let error = null

  try {
    for (let t = 0; t < MAX_TURNS; t++) {
      const res = await aiTurn(gameId)
      turns++
      if (res.state?.battleLog) {
        // Collect new log entries
        allLogs.push(...res.state.battleLog)
      }
      if (res.state?.gameOver) break
      if (!res.success) {
        error = `AI turn failed: ${JSON.stringify(res).slice(0, 200)}`
        break
      }
    }
  } catch (e) {
    error = e.message
  }

  let finalState
  try {
    finalState = await getState(gameId)
  } catch (e) {
    finalState = null
  }

  const winner = finalState?.state?.winner || null
  const gameOver = finalState?.state?.gameOver || false

  // Get winner's deployed characters
  let winnerCharacters = []
  if (winner && finalState?.state?.players) {
    const winnerPlayer = finalState.state.players.find(p => p.id === winner)
    if (winnerPlayer?.deployed) {
      for (const slot of winnerPlayer.deployed) {
        if (slot.character && slot.character.state !== 'retired') {
          winnerCharacters.push(slot.character.cardId)
        }
      }
    }
  }

  return { gameId, turns, logs: allLogs, winner, gameOver, error, winnerCharacters }
}

// Card names for detection
const CARD_NAMES = {
  action: ['攻击', '破甲攻击', '格挡', '防御', '回复', '回复大', '补充'],
  strategy: [
    '破坏者之钳','难绷假面','米歇尔红豆饼','原装米歇尔','战斗用Random star','黑色笔记本',
    '钢巴歇尔','石头','小·珍妮弗','折叠椅','丸君','铁打的距离感',
    '地狱火炸弹','孔雀','武士刀','熊霸米歇尔','村好剑','街边的星星贴纸',
    '家虎根绝','筹码','利根川','野蛮米歇尔','幸运四叶草','维修扳手','苦瓜','抹茶巴菲','黄瓜','朝日啤酒',
    '禁止事项','财团B的阴谋','无限制live格斗','我有异议','世界守护者','拿来吧你','乐','巧克力螺','俄罗斯轮盘',
    '小星星无限loop','五字不行','轨迹展','星光魔方','拆弹专家','复活赛','阿提斯特','诡异的蘑菇','何意味',
    '灵魂互换','是不想说话吗','视奸','老虎机','恩！情！','屹立不倒','灵光一闪','金玉','不仲蕾','做了！',
    'Fever!!!!!','回收站','我是纯良','禁止947','巴巴恩波神之力','啥是XXX','绿接粉','噜不动了'
  ],
  character: [
    '初始兰','初始摩卡','初始绯玛丽','初始巴','初始鸫',
    '初始香澄','初始有咲','初始多惠','初始沙绫','初始里美',
    '初始友希那','初始纱夜','初始莉莎','初始烧子','初始亚子',
    '初始心','初始美咲',
    '初始彩','初始千圣','初始伊芙'
  ]
}
const ALL_CARDS = [...CARD_NAMES.action, ...CARD_NAMES.strategy, ...CARD_NAMES.character]

// Enhanced detection: check both action text and details
function analyzeLogs(logs) {
  const usage = {}
  for (const name of ALL_CARDS) usage[name] = 0

  // Also track action patterns
  const actionPatterns = {
    '攻击': /攻击了/,
    '破甲攻击': /穿甲=true/,
    '格挡': /小格挡/,
    '防御': /大格挡/,
    '回复': /体力回满|从濒死中恢复/,
    '回复大': /大回复/,
    '补充': /补充摸了|招揽了/,
  }

  for (const entry of logs) {
    const text = (entry.action || '') + ' ' + (entry.details || '')

    // Check exact card name matches
    for (const name of ALL_CARDS) {
      if (text.includes(name)) usage[name]++
    }

    // Check pattern-based matches for action cards
    for (const [cardName, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(text) && !text.includes(cardName)) {
        // Pattern matched but card name wasn't already counted
        // Only count if this looks like a card play, not just any attack
        if (cardName === '攻击' && /攻击了/.test(text)) {
          // Regular attacks are from combat, not necessarily action cards
          // Don't double-count
        } else {
          usage[cardName]++
        }
      }
    }
  }

  // Post-process: 破甲攻击 detection via armorPierce details
  // The combat log says "穿甲=true" for armor pierce attacks
  for (const entry of logs) {
    const details = entry.details || ''
    if (details.includes('穿甲=true')) {
      usage['破甲攻击']++
    }
  }

  return usage
}

// Also track state-level metrics
function analyzeStateChanges(logs) {
  const metrics = {
    totalAttacks: 0,
    armorPierceAttacks: 0,
    blockApplied: 0,
    recoveryUsed: 0,
    bigRecoveryUsed: 0,
    replenishUsed: 0,
    strategyCardsPlayed: 0,
    characterSkillsUsed: 0,
  }

  for (const entry of logs) {
    const text = (entry.action || '') + ' ' + (entry.details || '')

    if (/攻击了/.test(text)) metrics.totalAttacks++
    if (/穿甲=true/.test(text)) metrics.armorPierceAttacks++
    if (/小格挡|大格挡/.test(text)) metrics.blockApplied++
    if (/体力回满|从濒死中恢复/.test(text) && !/大回复/.test(text)) metrics.recoveryUsed++
    if (/大回复/.test(text)) metrics.bigRecoveryUsed++
    if (/补充摸了|招揽了/.test(text)) metrics.replenishUsed++
    if (/使用了策略牌|装备了/.test(text)) metrics.strategyCardsPlayed++
    if (/技能/.test(text)) metrics.characterSkillsUsed++
  }

  return metrics
}

async function main() {
  console.log(`\n=== 邦邦武斗传 批量AI测试 v2 ===`)
  console.log(`测试场数: ${GAME_COUNT}, 每场最大回合: ${MAX_TURNS}\n`)

  const stats = {
    completed: 0,
    timeouts: 0,
    errors: 0,
    totalTurns: 0,
    wins: {},
    allLogs: [],
    errorDetails: [],
    allMetrics: [],
    winnerCharacters: {},
  }

  const startTime = Date.now()

  for (let i = 0; i < GAME_COUNT; i++) {
    process.stdout.write(`\r运行中: ${i + 1}/${GAME_COUNT}`)
    const result = await runOneBattle(i)

    if (result.error) {
      stats.errors++
      stats.errorDetails.push({ game: i, error: result.error })
    } else if (!result.gameOver) {
      stats.timeouts++
    } else {
      stats.completed++
      if (result.winner) {
        stats.wins[result.winner] = (stats.wins[result.winner] || 0) + 1
      }
      // Track winner's deployed characters
      if (result.winnerCharacters) {
        for (const charId of result.winnerCharacters) {
          stats.winnerCharacters[charId] = (stats.winnerCharacters[charId] || 0) + 1
        }
      }
    }

    stats.totalTurns += result.turns
    stats.allLogs.push(...result.logs)
    stats.allMetrics.push(analyzeStateChanges(result.logs))
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Aggregate metrics
  const totals = {}
  for (const m of stats.allMetrics) {
    for (const [k, v] of Object.entries(m)) {
      totals[k] = (totals[k] || 0) + v
    }
  }

  // Card usage analysis
  const usage = analyzeLogs(stats.allLogs)
  const usedCards = Object.entries(usage).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const unusedCards = Object.entries(usage).filter(([, v]) => v === 0)

  const unusedAction = unusedCards.filter(([n]) => CARD_NAMES.action.includes(n)).map(([n]) => n)
  const unusedStrategy = unusedCards.filter(([n]) => CARD_NAMES.strategy.includes(n)).map(([n]) => n)
  const unusedCharacter = unusedCards.filter(([n]) => CARD_NAMES.character.includes(n)).map(([n]) => n)

  console.log(`\n\n=== 测试结果 ===`)
  console.log(`耗时: ${elapsed}s`)
  console.log(`完成: ${stats.completed}, 超时: ${stats.timeouts}, 错误: ${stats.errors}`)
  console.log(`平均回合: ${(stats.totalTurns / GAME_COUNT).toFixed(1)}`)

  if (Object.keys(stats.wins).length > 0) {
    console.log(`\n--- 胜率 ---`)
    for (const [id, count] of Object.entries(stats.wins).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id}: ${count}胜 (${((count / stats.completed) * 100).toFixed(1)}%)`)
    }
  }

  // Winner characters analysis
  const winnerCharEntries = Object.entries(stats.winnerCharacters)
    .map(([charId, count]) => {
      const charName = CARD_NAMES.character.find(n => charId.includes(n.replace('初始', ''))) || charId
      return [charName, count]
    })
    .sort((a, b) => b[1] - a[1])

  if (winnerCharEntries.length > 0) {
    console.log(`\n--- 获胜阵容高频角色 (Top 10) ---`)
    for (const [name, count] of winnerCharEntries.slice(0, 10)) {
      console.log(`  ${name}: ${count}次`)
    }
  }

  console.log(`\n--- 行动统计 ---`)
  console.log(`  总攻击次数: ${totals.totalAttacks}`)
  console.log(`  破甲攻击次数: ${totals.armorPierceAttacks}`)
  console.log(`  格挡/防御使用: ${totals.blockApplied}`)
  console.log(`  回复使用: ${totals.recoveryUsed}`)
  console.log(`  大回复使用: ${totals.bigRecoveryUsed}`)
  console.log(`  补充使用: ${totals.replenishUsed}`)
  console.log(`  策略牌使用: ${totals.strategyCardsPlayed}`)

  console.log(`\n--- 使用过的卡牌 (${usedCards.length}/${ALL_CARDS.length}) ---`)
  for (const [name, count] of usedCards.slice(0, 25)) {
    console.log(`  ${name}: ${count}次`)
  }
  if (usedCards.length > 25) console.log(`  ... 等 ${usedCards.length - 25} 种`)

  console.log(`\n--- 从未使用的卡牌 (${unusedCards.length}/${ALL_CARDS.length}) ---`)
  if (unusedAction.length > 0) console.log(`  行动牌: ${unusedAction.join(', ')}`)
  if (unusedStrategy.length > 0) console.log(`  策略牌: ${unusedStrategy.join(', ')}`)
  if (unusedCharacter.length > 0) console.log(`  角色牌: ${unusedCharacter.join(', ')}`)

  if (stats.errorDetails.length > 0) {
    console.log(`\n--- 错误详情 ---`)
    for (const e of stats.errorDetails.slice(0, 5)) {
      console.log(`  游戏${e.game}: ${e.error}`)
    }
  }

  const output = {
    stats: { completed: stats.completed, timeouts: stats.timeouts, errors: stats.errors, totalTurns: stats.totalTurns, wins: stats.wins },
    totals,
    usedCards,
    unusedCards: { action: unusedAction, strategy: unusedStrategy, character: unusedCharacter },
    winnerCharacters: stats.winnerCharacters
  }
  const fs = require('fs')
  fs.writeFileSync('/Users/tano/Documents/GitHub/personal/bang_fight/test-results.json', JSON.stringify(output, null, 2))
  console.log(`\n详细结果已保存到 test-results.json`)
}

main().catch(console.error)
