<template>
  <div class="test-page">
    <!-- Top bar -->
    <header class="test-header">
      <h1 class="test-title">邦邦武斗传 - 卡牌测试</h1>
      <div class="test-actions">
        <button class="btn btn-primary" @click="createGame" :disabled="loading">
          创建游戏 (1人+1AI)
        </button>
        <button class="btn btn-green" @click="startTurn" :disabled="!game || loading">
          开始回合
        </button>
        <button class="btn btn-yellow" @click="drawCards" :disabled="!game || loading">
          摸牌
        </button>
        <button class="btn btn-red" @click="endTurn" :disabled="!game || loading">
          结束回合
        </button>
        <button class="btn btn-purple" @click="aiTurn" :disabled="!game || loading">
          AI回合
        </button>
        <button class="btn btn-gray" @click="refreshState" :disabled="!game">
          刷新状态
        </button>
        <span class="action-divider"></span>
        <button class="btn btn-orange" @click="createAiGame(2)" :disabled="loading">
          AI对战 (2AI)
        </button>
        <button class="btn btn-orange" @click="createAiGame(3)" :disabled="loading">
          AI对战 (3AI)
        </button>
        <button v-if="!autoBattling" class="btn btn-cyan" @click="startAutoBattle" :disabled="!game || !!game.gameOver || loading">
          自动对战
        </button>
        <button v-else class="btn btn-red" @click="stopAutoBattle">
          停止对战
        </button>
        <span v-if="autoBattling" class="auto-battle-status">
          回合 {{ game?.turnNumber ?? 0 }} | 速度: {{ autoBattleSpeed }}ms/回合
          <button class="btn btn-tiny" @click="changeSpeed(-100)">加速</button>
          <button class="btn btn-tiny" @click="changeSpeed(100)">减速</button>
        </span>
        <span class="action-divider"></span>
        <div class="batch-params">
          <button class="btn btn-pink" @click="runBatchTest" :disabled="batchTesting">
            {{ batchTesting ? `测试中 ${batchProgress}/${batchParams.gameCount}` : '批量AI测试' }}
          </button>
          <label class="param-label">
            局数:
            <input type="number" v-model.number="batchParams.gameCount" min="1" max="500" class="param-input" :disabled="batchTesting" />
          </label>
          <label class="param-label">
            最大回合:
            <input type="number" v-model.number="batchParams.maxTurns" min="10" max="500" class="param-input" :disabled="batchTesting" />
          </label>
          <label class="param-label">
            AI人数:
            <select v-model.number="batchParams.aiCount" class="param-input" :disabled="batchTesting">
              <option :value="2">2人</option>
              <option :value="3">3人</option>
              <option :value="4">4人</option>
            </select>
          </label>
        </div>
      </div>
      <div v-if="game" class="game-info">
        <span>游戏ID: {{ game.gameId }}</span>
        <span>回合: {{ game.turnNumber }}</span>
        <span>阶段: {{ phaseName(game.turnPhase) }}</span>
        <span>当前玩家: {{ game.players[game.currentPlayerIndex]?.name }}</span>
        <span v-if="game.gameOver" class="game-over">游戏结束! 胜者: {{ game.winner }}</span>
      </div>
    </header>

    <div class="test-body">
      <!-- Left: Card selector -->
      <aside class="card-panel">
        <h2 class="panel-title">卡牌列表</h2>
        <div class="card-filter">
          <button v-for="f in filters" :key="f.key" class="filter-btn" :class="{ active: activeFilter === f.key }"
            @click="activeFilter = f.key">
            {{ f.label }}
          </button>
        </div>
        <div class="card-list">
          <div v-for="card in filteredCards" :key="card.id" class="card-item"
            :class="{ 'card-item-selected': selectedCardId === card.id }" @click="selectCardFromList(card)">
            <div class="card-item-info">
              <span class="card-item-name">{{ card.name }}</span>
              <span class="card-item-id">{{ card.id }}</span>
            </div>
            <span class="card-item-type">{{ cardTypeLabel(card) }}</span>
          </div>
        </div>
      </aside>

      <!-- Center: Game state + action panel -->
      <main class="game-panel">
        <!-- Action panel for selected card -->
        <div v-if="selectedCard" class="action-panel">
          <h3 class="action-title">
            {{ selectedCard.name }} ({{ selectedCard.id }})
          </h3>
          <p class="action-desc">{{ getCardDescription(selectedCard) }}</p>
          <p class="action-type-hint">
            API: <code>{{ resolvedAction.apiType }}</code>
            &nbsp;|&nbsp; 类型: <code>{{ resolvedAction.actionType }}</code>
          </p>

          <!-- Attack: select attacker from own deployed -->
          <div v-if="needsAttacker" class="target-select">
            <label class="target-label">① 选择攻击者 (己方):</label>
            <div class="target-options">
              <button v-for="slot in myDeployedWithChar" :key="slot.character!.uid" class="target-btn"
                :class="{ active: selectedAttacker === slot.character!.uid }"
                @click="selectedAttacker = slot.character!.uid">
                {{ getCharacterName(slot.character!.cardId) }}
                ATK:{{ slot.character!.attack }}
                {{ slot.character!.hasActionPoint ? '' : '(已行动)' }}
              </button>
            </div>
          </div>

          <!-- Attack: select enemy target character -->
          <div v-if="needsEnemyCharTarget" class="target-select">
            <label class="target-label">{{ needsAttacker ? '②' : '' }} 选择目标 (敌方角色):</label>
            <div class="target-options">
              <template v-for="p in enemyPlayers" :key="p.id">
                <button v-for="slot in p.deployed.filter(s => s.character && s.character.state !== 'retired')" :key="slot.character!.uid"
                  class="target-btn" :class="{ active: selectedTarget === slot.character!.uid && selectedTargetPlayer === p.id }"
                  @click="selectedTarget = slot.character!.uid; selectedTargetPlayer = p.id">
                  {{ p.name }} - {{ getCharacterName(slot.character!.cardId) }}
                  (HP:{{ slot.character!.currentHp }})
                </button>
              </template>
            </div>
          </div>

          <!-- Attack: select enemy player (for direct attack) -->
          <div v-if="needsPlayerTarget" class="target-select">
            <label class="target-label">选择目标玩家:</label>
            <div class="target-options">
              <button v-for="p in enemyPlayers" :key="p.id" class="target-btn"
                :class="{ active: selectedTargetPlayer === p.id }"
                @click="selectedTargetPlayer = p.id">
                {{ p.name }} (HP:{{ p.hp }})
              </button>
            </div>
          </div>

          <!-- Ally target (block, recovery, equip, etc.) -->
          <div v-if="needsAllyTarget" class="target-select">
            <label class="target-label">选择己方目标角色:</label>
            <div class="target-options">
              <button v-for="slot in myDeployedWithChar" :key="slot.character!.uid" class="target-btn"
                :class="{ active: selectedTarget === slot.character!.uid }"
                @click="selectedTarget = slot.character!.uid">
                {{ getCharacterName(slot.character!.cardId) }}
                (HP:{{ slot.character!.currentHp }}/{{ slot.character!.maxHp }})
              </button>
            </div>
          </div>

          <!-- Recovery mode: player or character -->
          <div v-if="needsRecoveryMode" class="target-select">
            <label class="target-label">回复目标类型:</label>
            <div class="target-options">
              <button class="target-btn" :class="{ active: recoveryMode === 'character' }"
                @click="recoveryMode = 'character'">回复角色</button>
              <button class="target-btn" :class="{ active: recoveryMode === 'player' }"
                @click="recoveryMode = 'player'">回复玩家HP</button>
            </div>
          </div>

          <!-- Replenish mode -->
          <div v-if="needsReplenishMode" class="target-select">
            <label class="target-label">补充方式:</label>
            <div class="target-options">
              <button class="target-btn" :class="{ active: replenishMode === 'draw' }"
                @click="replenishMode = 'draw'">摸2张牌</button>
              <button class="target-btn" :class="{ active: replenishMode === 'recruit' }"
                @click="replenishMode = 'recruit'">招揽角色</button>
            </div>
          </div>

          <!-- Position selection for deploy -->
          <div v-if="needsPosition" class="target-select">
            <label class="target-label">选择部署位置:</label>
            <div class="target-options">
              <button v-for="i in 5" :key="i" class="target-btn"
                :class="{ active: selectedPosition === i - 1 }" @click="selectedPosition = i - 1">
                位置{{ i }}
                <template v-if="myDeployed[i-1]?.character">
                  ({{ getCharacterName(myDeployed[i-1].character!.cardId) }})
                </template>
                <template v-else>(空)</template>
              </button>
            </div>
          </div>

          <!-- Replacement character (when deploying to occupied slot) -->
          <div v-if="needsReplacement" class="target-select">
            <label class="target-label">选择要替换的场上角色:</label>
            <div class="target-options">
              <button v-for="slot in myDeployedWithChar" :key="slot.character!.uid" class="target-btn"
                :class="{ active: selectedReplacement === slot.character!.uid }"
                @click="selectedReplacement = slot.character!.uid">
                位置{{ slot.position + 1 }}: {{ getCharacterName(slot.character!.cardId) }}
              </button>
            </div>
          </div>

          <!-- Armor pierce toggle for attack -->
          <div v-if="isAttackAction" class="target-select">
            <label class="target-label">攻击类型:</label>
            <div class="target-options">
              <button class="target-btn" :class="{ active: !armorPierce }"
                @click="armorPierce = false">普通攻击</button>
              <button class="target-btn" :class="{ active: armorPierce }"
                @click="armorPierce = true">破甲攻击</button>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-primary" @click="executeAction" :disabled="loading">
              执行
            </button>
            <button class="btn btn-gray" @click="clearSelection">取消</button>
          </div>
        </div>

        <!-- Players -->
        <div class="players-grid">
          <div v-for="p in game?.players ?? []" :key="p.id" class="player-card"
            :class="{ 'player-current': game?.currentPlayerIndex === game?.players.indexOf(p), 'player-dead': !p.isAlive }">
            <div class="player-header">
              <span class="player-name">{{ p.name }} {{ p.isAi ? '(AI)' : '(玩家)' }}</span>
              <span class="player-hp">HP: {{ p.hp }}/{{ p.maxHp }}</span>
              <span v-if="!p.isAlive" class="player-retired">已退场</span>
            </div>

            <!-- Deployed characters -->
            <div class="deployed-area">
              <div v-for="slot in p.deployed" :key="slot.position" class="deploy-slot">
                <div v-if="slot.character" class="deployed-char"
                  :class="{ 'char-near-death': slot.character.state === 'nearDeath', 'char-retired': slot.character.state === 'retired' }">
                  <div class="char-name">{{ getCharacterName(slot.character.cardId) }}</div>
                  <div class="char-stats">
                    <span class="stat-hp">{{ slot.character.currentHp }}/{{ slot.character.maxHp }}</span>
                    <span class="stat-atk">ATK:{{ slot.character.attack }}</span>
                    <span class="stat-armor" v-if="slot.character.armor">甲:{{ slot.character.armor }}</span>
                  </div>
                  <div class="char-state">{{ stateName(slot.character.state) }} {{ slot.character.hasActionPoint ? '✓AP' : '✗AP' }}</div>
                  <div v-if="slot.character.keywords.length" class="char-keywords">
                    {{ slot.character.keywords.join(', ') }}
                  </div>
                  <div v-if="slot.character.buffs.length" class="char-buffs">
                    <span v-for="b in slot.character.buffs" :key="b.type" class="buff-tag">
                      {{ b.type }}({{ b.remainingTurns }})
                    </span>
                  </div>
                  <div v-if="slot.character.debuffs.length" class="char-debuffs">
                    <span v-for="d in slot.character.debuffs" :key="d.type" class="debuff-tag">
                      {{ d.type }}({{ d.remainingTurns }})
                    </span>
                  </div>
                  <div v-if="slot.equipment" class="char-equip">
                    装备: {{ getStrategyName(slot.equipment.cardId) }}
                  </div>
                </div>
                <div v-else class="deploy-empty">空位</div>
              </div>
            </div>

            <!-- Hand -->
            <div class="hand-area">
              <div class="hand-label">手牌 ({{ p.hand.length }}):</div>
              <div class="hand-cards">
                <span v-for="c in p.hand" :key="c.uid" class="hand-card-tag" :class="handCardClass(c)"
                  @click="quickSelectCard(c, p)">
                  {{ getCardNameById(c.cardId) || c.cardId }}
                </span>
              </div>
            </div>

            <!-- Graveyard & discard -->
            <div class="pile-info">
              <span>休息室: {{ p.graveyard.length }}</span>
              <span>弃牌堆: {{ p.discardPile.length }}</span>
              <span>判定区: {{ p.judgmentZone.length }}</span>
            </div>
          </div>
        </div>

        <!-- Decks info -->
        <div v-if="game" class="decks-info">
          <span>角色池: {{ game.characterPool.length }}</span>
          <span>行动牌堆: {{ game.actionDeck.length }}</span>
          <span>策略牌堆: {{ game.strategyDeck.length }}</span>
        </div>

        <!-- Pending effects -->
        <div v-if="game?.pendingEffects?.length" class="pending-effects">
          <h3>待处理效果:</h3>
          <div v-for="pe in game.pendingEffects" :key="pe.id" class="pending-item">
            {{ pe.type }} | {{ pe.source }} → {{ pe.target }} | {{ JSON.stringify(pe.params) }}
          </div>
        </div>

        <!-- Batch test statistics -->
        <div v-if="batchStats" class="stats-panel">
          <h2 class="panel-title">批量测试统计</h2>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ batchStats.totalBattles }}</div>
              <div class="stat-label">总对战数</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ batchStats.avgTurns.toFixed(1) }}</div>
              <div class="stat-label">平均回合数</div>
            </div>
            <div class="stat-card">
              <div class="stat-value text-yellow">{{ batchStats.timeouts }}</div>
              <div class="stat-label">超时</div>
            </div>
            <div class="stat-card">
              <div class="stat-value text-red">{{ batchStats.errors.length }}</div>
              <div class="stat-label">错误</div>
            </div>
          </div>

          <div class="stats-section">
            <h3>胜率统计</h3>
            <div v-for="(wins, player) in batchStats.wins" :key="player" class="win-bar">
              <span class="win-player">{{ player }}</span>
              <div class="win-bar-track">
                <div class="win-bar-fill" :style="{ width: (wins / batchStats.totalBattles * 100) + '%' }"></div>
              </div>
              <span class="win-count">{{ wins }}胜 ({{ (wins / batchStats.totalBattles * 100).toFixed(1) }}%)</span>
            </div>
          </div>

          <div v-if="topWinnerCharacters.length > 0" class="stats-section">
            <h3 @click="showAllWinnerChars = !showAllWinnerChars" class="clickable-title">
              获胜阵容高频角色 ({{ Object.keys(batchStats.winnerCharacters).length }}个)
              <span class="toggle-icon">{{ showAllWinnerChars ? '▼' : '▶' }}</span>
            </h3>
            <div class="card-usage-list">
              <div v-for="item in topWinnerCharacters" :key="item.id" class="card-usage-item winner-char">
                <span class="card-usage-name">{{ item.name }}</span>
                <span class="card-usage-count">{{ item.count }}次</span>
              </div>
            </div>
          </div>

          <div class="stats-section">
            <h3 @click="showAllUsage = !showAllUsage" class="clickable-title">
              卡牌使用统计 ({{ Object.keys(batchStats.cardUsage).length }}/{{ allCards.length }})
              <span class="toggle-icon">{{ showAllUsage ? '▼' : '▶' }}</span>
            </h3>
            <div v-if="showAllUsage">
              <div v-for="group in cardUsageGroups" :key="group.label" class="usage-group">
                <h4 class="usage-group-title">{{ group.label }} ({{ group.usedCount }}/{{ group.total }})</h4>
                <div class="card-usage-list">
                  <div v-for="item in group.items" :key="item.id" class="card-usage-item">
                    <span class="card-usage-name">{{ item.name }}</span>
                    <span class="card-usage-count" :class="{ 'count-zero': item.count === 0 }">{{ item.count }}次</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="card-usage-list">
              <div v-for="[cardId, count] in topUsedCards" :key="cardId" class="card-usage-item">
                <span class="card-usage-name">{{ getCardNameById(cardId) }}</span>
                <span class="card-usage-count">{{ count }}次</span>
              </div>
            </div>
          </div>

          <div class="stats-section">
            <h3>未使用的卡牌 ({{ batchStats.unusedCards.length }}张)</h3>
            <div class="unused-cards-list">
              <span v-for="cardId in batchStats.unusedCards" :key="cardId" class="unused-card-tag">
                {{ getCardNameById(cardId) }}
              </span>
            </div>
          </div>

          <div class="stats-section">
            <h3 @click="showBattleDetails = !showBattleDetails" class="clickable-title">
              每局详情 ({{ batchStats.battles.length }}局)
              <span class="toggle-icon">{{ showBattleDetails ? '▼' : '▶' }}</span>
            </h3>
            <div v-if="showBattleDetails" class="battle-details-list">
              <div class="battle-details-header">
                <span class="bd-col bd-idx">#</span>
                <span class="bd-col bd-turns">回合</span>
                <span class="bd-col bd-result">结果</span>
              </div>
              <div v-for="b in batchStats.battles" :key="b.index" class="battle-detail-row"
                :class="{ 'bd-timeout': b.timeout, 'bd-error': b.error }">
                <span class="bd-col bd-idx">{{ b.index }}</span>
                <span class="bd-col bd-turns">{{ b.turns }}</span>
                <span class="bd-col bd-result">
                  <template v-if="b.error">错误</template>
                  <template v-else-if="b.timeout">超时</template>
                  <template v-else>{{ b.winner ?? '-' }}胜</template>
                </span>
              </div>
            </div>
          </div>

          <div v-if="batchStats.errors.length" class="stats-section">
            <h3>错误记录</h3>
            <div class="error-list">
              <div v-for="(err, i) in batchStats.errors.slice(0, 10)" :key="i" class="error-item">
                {{ err }}
              </div>
              <div v-if="batchStats.errors.length > 10" class="error-more">
                ...还有 {{ batchStats.errors.length - 10 }} 条错误
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Right: Log & result -->
      <aside class="log-panel">
        <h2 class="panel-title">操作结果</h2>
        <div v-if="lastResult" class="result-box" :class="lastResult.success ? 'result-ok' : 'result-fail'">
          <pre>{{ formatResult(lastResult) }}</pre>
        </div>

        <h2 class="panel-title">战斗日志</h2>
        <div class="log-list">
          <div v-for="(entry, i) in (game?.battleLog ?? []).slice().reverse()" :key="i" class="log-entry">
            <span class="log-turn">[T{{ entry.turn }}]</span>
            <span class="log-phase">{{ entry.phase }}</span>
            <span class="log-player">{{ entry.playerId }}</span>
            <span class="log-action">{{ entry.action }}</span>
            <span v-if="entry.details" class="log-details">{{ entry.details }}</span>
          </div>
        </div>

        <h2 class="panel-title">错误</h2>
        <div v-if="store.error" class="error-box">{{ store.error }}</div>
        <div v-else class="error-box empty">无错误</div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game'
import {
  CHARACTER_CARDS, ACTION_CARDS, STRATEGY_CARDS,
  getCardById, ACTION_CARD_DESCRIPTIONS, STRATEGY_CARD_DESCRIPTIONS,
} from '../types/cards-data'
import type { CardInstance, ActionCard, StrategyCard } from '../types/card'
import type { PlayerState, DeployedSlot } from '../types/game'

// Batch test types
interface BattleDetail {
  index: number
  turns: number
  winner: string | null
  timeout: boolean
  error: string | null
}

interface BattleStats {
  totalBattles: number
  wins: Record<string, number>
  avgTurns: number
  totalTurns: number
  timeouts: number
  cardUsage: Record<string, number>
  unusedCards: string[]
  errors: string[]
  battles: BattleDetail[]
  winnerCharacters: Record<string, number> // character id → win count
}

const store = useGameStore()
const game = computed(() => store.gameState)
const loading = computed(() => store.loading)

const PLAYER_ID = 'player_0'

const myPlayer = computed(() => game.value?.players.find(p => p.id === PLAYER_ID))
const enemyPlayers = computed(() => game.value?.players.filter(p => p.id !== PLAYER_ID && p.isAlive) ?? [])
const myDeployed = computed(() => myPlayer.value?.deployed ?? [])
const myDeployedWithChar = computed(() => myDeployed.value.filter(s => s.character !== null) as DeployedSlot[])

// Card filter
const filters = [
  { key: 'all', label: '全部' },
  { key: 'action', label: '行动牌' },
  { key: 'strategy', label: '策略牌' },
  { key: 'character', label: '角色牌' },
]
const activeFilter = ref('all')

const allCards = computed(() => [
  ...CHARACTER_CARDS.map(c => ({ ...c, _cat: 'character' as const })),
  ...ACTION_CARDS.map(c => ({ ...c, _cat: 'action' as const })),
  ...STRATEGY_CARDS.map(c => ({ ...c, _cat: 'strategy' as const })),
])

const filteredCards = computed(() => {
  if (activeFilter.value === 'all') return allCards.value
  return allCards.value.filter(c => c._cat === activeFilter.value)
})

const showAllUsage = ref(false)
const showBattleDetails = ref(false)

const topUsedCards = computed(() => {
  if (!batchStats.value) return []
  return Object.entries(batchStats.value.cardUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
})

const cardUsageGroups = computed(() => {
  if (!batchStats.value) return []
  const usage = batchStats.value.cardUsage
  const groups = [
    { label: '行动牌', cards: ACTION_CARDS, _cat: 'action' },
    { label: '策略牌', cards: STRATEGY_CARDS, _cat: 'strategy' },
    { label: '角色牌', cards: CHARACTER_CARDS, _cat: 'character' },
  ]
  return groups.map(g => {
    const items = g.cards
      .map(c => ({ id: c.id, name: c.name, count: usage[c.id] ?? 0 }))
      .sort((a, b) => b.count - a.count)
    const usedCount = items.filter(i => i.count > 0).length
    return { label: g.label, total: g.cards.length, usedCount, items }
  })
})

const topWinnerCharacters = computed(() => {
  if (!batchStats.value) return []
  const entries = Object.entries(batchStats.value.winnerCharacters)
  const all = entries
    .map(([charId, count]) => {
      const charDef = CHARACTER_CARDS.find(c => c.id === charId)
      return { id: charId, name: charDef?.name ?? charId, count }
    })
    .sort((a, b) => b.count - a.count)
  return showAllWinnerChars.value ? all : all.slice(0, 10)
})

const showAllWinnerChars = ref(false)

// Selection state
const selectedCard = ref<any>(null)
const selectedCardId = ref<string | null>(null)
const selectedAttacker = ref<string | null>(null)
const selectedTarget = ref<string | null>(null)
const selectedTargetPlayer = ref<string | null>(null)
const selectedPosition = ref(0)
const selectedReplacement = ref<string | null>(null)
const recoveryMode = ref<'character' | 'player'>('character')
const replenishMode = ref<'draw' | 'recruit'>('draw')
const armorPierce = ref(false)
const lastResult = ref<any>(null)

// Resolve what API action the selected card maps to
const resolvedAction = computed(() => {
  const card = selectedCard.value
  if (!card) return { apiType: '', actionType: '' }

  const isChar = isCharacterCard(card)
  const isAction = card.category === 'action' || card._cat === 'action'
  const isStrategy = card.category === 'strategy' || card._cat === 'strategy'

  if (isChar) {
    // Check if the target position is occupied
    const slot = myDeployed.value[selectedPosition.value]
    if (slot?.character) {
      return { apiType: 'replaceCharacter', actionType: 'deploy(替换)' }
    }
    return { apiType: 'deploy', actionType: 'deploy' }
  }

  if (isAction) {
    const at = (card as ActionCard).actionType
    if (at === 'attack' || at === 'armorPierce') {
      return { apiType: 'attack', actionType: at }
    }
    return { apiType: 'playCard', actionType: at }
  }

  if (isStrategy) {
    const st = (card as StrategyCard).strategyType
    return { apiType: 'playCard', actionType: st === 'deployable' ? 'equipStrategy' : 'instantStrategy' }
  }

  return { apiType: 'playCard', actionType: 'unknown' }
})

// Dynamic UI flags
const isAttackAction = computed(() => {
  const at = resolvedAction.value.actionType
  return at === 'attack' || at === 'armorPierce'
})

const needsAttacker = computed(() => isAttackAction.value)

const needsEnemyCharTarget = computed(() => {
  const at = resolvedAction.value.actionType
  if (at === 'attack' || at === 'armorPierce') return true
  // Some strategy cards target enemy characters
  const card = selectedCard.value
  if (!card) return false
  if (card.category === 'strategy' || card._cat === 'strategy') {
    const id = card.id
    // Cards that target enemy characters
    return ['A0003', 'A0012', 'B0016'].includes(id) || false
  }
  return false
})

const needsPlayerTarget = computed(() => {
  const card = selectedCard.value
  if (!card) return false
  if (card.category === 'strategy' || card._cat === 'strategy') {
    const id = card.id
    // Cards that target an enemy player
    return ['A0004', 'A0013', 'A0015', 'B0002', 'C0010', 'C0011', 'C0012', 'D0011', 'D0014'].includes(id)
  }
  return false
})

const needsAllyTarget = computed(() => {
  const at = resolvedAction.value.actionType
  if (at === 'smallBlock' || at === 'recovery') return true
  if (at === 'equipStrategy') return true
  // Strategy cards targeting ally
  const card = selectedCard.value
  if (card && (card.category === 'strategy' || card._cat === 'strategy')) {
    const id = card.id
    return ['A0014', 'B0010', 'B0015', 'D0004'].includes(id)
  }
  return false
})

const needsRecoveryMode = computed(() => {
  const at = resolvedAction.value.actionType
  return at === 'recovery' || at === 'bigRecovery'
})

const needsReplenishMode = computed(() => {
  return resolvedAction.value.actionType === 'replenish'
})

const needsPosition = computed(() => {
  return isCharacterCard(selectedCard.value)
})

const needsReplacement = computed(() => {
  if (!isCharacterCard(selectedCard.value)) return false
  const slot = myDeployed.value[selectedPosition.value]
  return slot?.character !== null
})

// Card helpers
function isCharacterCard(card: any): boolean {
  if (!card) return false
  return card._cat === 'character' || card.category === 'character'
}

function getCardDescription(card: any): string {
  if (card.category === 'action' || card._cat === 'action') {
    return ACTION_CARD_DESCRIPTIONS[card.actionType] ?? ''
  }
  if (card.category === 'strategy' || card._cat === 'strategy') {
    return STRATEGY_CARD_DESCRIPTIONS[card.id] ?? card.description ?? ''
  }
  if (card.category === 'character' || card._cat === 'character') {
    return card.skills?.[0]?.description ?? ''
  }
  return ''
}

function cardTypeLabel(card: any): string {
  if (card._cat === 'character') return '角色'
  if (card._cat === 'action') {
    const labels: Record<string, string> = {
      attack: '攻击', armorPierce: '破甲', bigBlock: '防御',
      smallBlock: '格挡', recovery: '回复', bigRecovery: '回复大', replenish: '补充',
    }
    return labels[card.actionType] ?? card.actionType
  }
  if (card._cat === 'strategy') {
    return card.strategyType === 'deployable' ? '道具' : '即时'
  }
  return '?'
}

function getCharacterName(cardId: string): string {
  return CHARACTER_CARDS.find(c => c.id === cardId)?.name ?? cardId
}

function getStrategyName(cardId: string): string {
  return STRATEGY_CARDS.find(c => c.id === cardId)?.name ?? cardId
}

function getCardNameById(cardId: string): string {
  return getCardById(cardId)?.name ?? cardId
}

function handCardClass(c: CardInstance): string {
  const def = getCardById(c.cardId)
  if (!def) return ''
  if (def.category === 'character') return 'hc-char'
  if (def.category === 'action') return 'hc-action'
  if (def.category === 'strategy') return 'hc-strategy'
  return ''
}

function stateName(s: string): string {
  const map: Record<string, string> = { normal: '正常', nearDeath: '濒死', retired: '退场' }
  return map[s] ?? s
}

function phaseName(p: string): string {
  const map: Record<string, string> = {
    judgment: '判定', draw: '摸牌', action: '行动', discard: '弃牌', ended: '结束',
  }
  return map[p] ?? p
}

function formatResult(r: any): string {
  return JSON.stringify(r, null, 2)
}

// Card selection
function selectCardFromList(card: any) {
  selectedCard.value = { ...card }
  selectedCardId.value = card.id
  resetSelectionParams()
}

function quickSelectCard(c: CardInstance, player: PlayerState) {
  const card = getCardById(c.cardId)
  if (!card) return
  if (player.id !== PLAYER_ID) {
    lastResult.value = { success: false, message: '只能使用自己的手牌' }
    return
  }
  selectedCard.value = { ...card, _instanceUid: c.uid }
  selectedCardId.value = card.id
  resetSelectionParams()
}

function resetSelectionParams() {
  selectedAttacker.value = null
  selectedTarget.value = null
  selectedTargetPlayer.value = null
  selectedPosition.value = 0
  selectedReplacement.value = null
  recoveryMode.value = 'character'
  replenishMode.value = 'draw'
  armorPierce.value = false
}

function clearSelection() {
  selectedCard.value = null
  selectedCardId.value = null
  resetSelectionParams()
}

// Auto-battle state
const autoBattling = ref(false)
const autoBattleSpeed = ref(500)
let autoBattleTimer: ReturnType<typeof setTimeout> | null = null

// Batch test state
const batchTesting = ref(false)
const batchProgress = ref(0)
const batchStats = ref<BattleStats | null>(null)
const batchParams = ref({
  gameCount: 10,
  maxTurns: 100,
  aiCount: 2,
})

// Actions
async function createGame() {
  stopAutoBattle()
  await store.createGame(1, 1)
  lastResult.value = { success: true, message: '游戏已创建 (1人+1AI)' }
}

async function createAiGame(aiCount: number) {
  stopAutoBattle()
  await store.createGame(0, aiCount)
  lastResult.value = { success: true, message: `游戏已创建 (${aiCount}AI 对战)` }
}

async function startTurn() {
  const r = await store.submitAction('startTurn')
  lastResult.value = r
}

async function drawCards() {
  const r = await store.submitAction('draw')
  lastResult.value = r
}

async function endTurn() {
  const r = await store.submitAction('endTurn')
  lastResult.value = r
}

async function aiTurn() {
  await store.triggerAiTurn()
  lastResult.value = { success: true, message: 'AI回合完成' }
}

async function refreshState() {
  await store.fetchState()
}

function startAutoBattle() {
  if (!game.value || game.value.gameOver) return
  autoBattling.value = true
  runAutoBattleStep()
}

function stopAutoBattle() {
  autoBattling.value = false
  if (autoBattleTimer) {
    clearTimeout(autoBattleTimer)
    autoBattleTimer = null
  }
}

function changeSpeed(delta: number) {
  autoBattleSpeed.value = Math.max(100, Math.min(2000, autoBattleSpeed.value + delta))
}

async function runAutoBattleStep() {
  if (!autoBattling.value || !game.value || game.value.gameOver) {
    autoBattling.value = false
    return
  }
  try {
    await store.triggerAiTurn()
  } catch (e) {
    lastResult.value = { success: false, message: String(e) }
    autoBattling.value = false
    return
  }
  if (game.value?.gameOver) {
    autoBattling.value = false
    lastResult.value = { success: true, message: `对战结束! 胜者: ${game.value.winner}` }
    return
  }
  autoBattleTimer = setTimeout(runAutoBattleStep, autoBattleSpeed.value)
}

// Batch test
async function runBatchTest() {
  batchTesting.value = true
  batchProgress.value = 0
  batchStats.value = {
    totalBattles: 0,
    wins: {},
    avgTurns: 0,
    totalTurns: 0,
    timeouts: 0,
    cardUsage: {},
    unusedCards: [],
    errors: [],
    battles: [],
    winnerCharacters: {},
  }

  const stats = batchStats.value
  const { gameCount, maxTurns, aiCount } = batchParams.value

  for (let i = 0; i < gameCount; i++) {
    batchProgress.value = i + 1

    try {
      // Create game
      const createRes = await fetch('/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 0, aiCount }),
      })
      const createData = await createRes.json()

      if (!createData.success) {
        stats.errors.push(`Battle ${i + 1}: Failed to create game`)
        stats.battles.push({ index: i + 1, turns: 0, winner: null, timeout: false, error: '创建失败' })
        continue
      }

      const gameId = createData.gameId
      let gameOver = false
      let turns = 0
      let winner: string | null = null
      let battleError: string | null = null

      // Run turns
      while (!gameOver && turns < maxTurns) {
        const turnRes = await fetch(`/game/${gameId}/ai-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const turnData = await turnRes.json()

        if (!turnData.success) {
          battleError = turnData.message || 'Unknown error'
          stats.errors.push(`Battle ${i + 1} Turn ${turns + 1}: ${battleError}`)
          break
        }

        turns++
        const state = turnData.state

        if (state.gameOver) {
          gameOver = true
          winner = state.winner || 'unknown'
          const winnerKey = winner as string
          stats.wins[winnerKey] = (stats.wins[winnerKey] || 0) + 1

          // Record winner's deployed characters
          const winnerPlayer = state.players?.find((p: any) => p.id === winner)
          if (winnerPlayer?.deployed) {
            for (const slot of winnerPlayer.deployed) {
              if (slot.character && slot.character.state !== 'retired') {
                const charId = slot.character.cardId
                stats.winnerCharacters[charId] = (stats.winnerCharacters[charId] || 0) + 1
              }
            }
          }

          // Collect card usage from battle log (check both action and details)
          for (const entry of state.battleLog || []) {
            const text = (entry.action || '') + ' ' + (entry.details || '')
            for (const card of [...CHARACTER_CARDS, ...ACTION_CARDS, ...STRATEGY_CARDS]) {
              if (text.includes(card.name)) {
                stats.cardUsage[card.id] = (stats.cardUsage[card.id] || 0) + 1
              }
            }
            if (text.includes('穿甲=true')) {
              const apCard = ACTION_CARDS.find(c => c.actionType === 'armorPierce')
              if (apCard) stats.cardUsage[apCard.id] = (stats.cardUsage[apCard.id] || 0) + 1
            }
          }
        }
      }

      const isTimeout = turns >= maxTurns && !gameOver
      if (isTimeout) stats.timeouts++

      stats.totalBattles++
      stats.totalTurns += turns
      stats.battles.push({
        index: i + 1,
        turns,
        winner,
        timeout: isTimeout,
        error: battleError,
      })

    } catch (e) {
      stats.errors.push(`Battle ${i + 1}: ${String(e)}`)
    }
  }

  // Calculate averages
  if (stats.totalBattles > 0) {
    stats.avgTurns = stats.totalTurns / stats.totalBattles
  }

  // Find unused cards
  const allCardIds = [
    ...CHARACTER_CARDS.map(c => c.id),
    ...ACTION_CARDS.map(c => c.id),
    ...STRATEGY_CARDS.map(c => c.id),
  ]
  stats.unusedCards = allCardIds.filter(id => !stats.cardUsage[id])

  batchTesting.value = false
  lastResult.value = { success: true, message: `批量测试完成: ${stats.totalBattles}局` }
}

async function executeAction() {
  if (!selectedCard.value) return
  const card = selectedCard.value
  const cardUid = card._instanceUid as string | undefined

  // ====== Character card → deploy / replace ======
  if (isCharacterCard(card)) {
    if (!cardUid) {
      lastResult.value = { success: false, message: '请从手牌中点击角色卡选择' }
      return
    }
    const slot = myDeployed.value[selectedPosition.value]
    if (slot?.character) {
      // Replace existing character
      const r = await store.submitAction('replaceCharacter', {
        deployedUid: slot.character.uid,
        handCardUid: cardUid,
      })
      lastResult.value = r
    } else {
      const r = await store.submitAction('deploy', {
        cardUid,
        position: selectedPosition.value,
      })
      lastResult.value = r
    }
    clearSelection()
    return
  }

  // ====== Action card ======
  if (card.category === 'action' || card._cat === 'action') {
    const actionType = (card as ActionCard).actionType

    if (!cardUid) {
      lastResult.value = { success: false, message: '请从手牌中点击行动牌选择' }
      return
    }

    // Attack / ArmorPierce → use 'attack' API
    if (actionType === 'attack' || actionType === 'armorPierce') {
      if (!selectedAttacker.value) {
        lastResult.value = { success: false, message: '请选择攻击者' }
        return
      }
      if (!selectedTarget.value || !selectedTargetPlayer.value) {
        lastResult.value = { success: false, message: '请选择攻击目标' }
        return
      }
      const r = await store.submitAction('attack', {
        attackerCharUid: selectedAttacker.value,
        targetPlayerId: selectedTargetPlayer.value,
        targetCharUid: selectedTarget.value,
        armorPierce: actionType === 'armorPierce' || armorPierce.value,
      })
      lastResult.value = r
      clearSelection()
      return
    }

    // Small block → target ally
    if (actionType === 'smallBlock') {
      if (!selectedTarget.value) {
        lastResult.value = { success: false, message: '请选择要保护的己方角色' }
        return
      }
      const r = await store.submitAction('playCard', {
        cardUid,
        params: { targetCharUid: selectedTarget.value },
      })
      lastResult.value = r
      clearSelection()
      return
    }

    // Recovery
    if (actionType === 'recovery' || actionType === 'bigRecovery') {
      if (recoveryMode.value === 'player') {
        const r = await store.submitAction('playCard', {
          cardUid,
          params: { targetType: 'player' },
        })
        lastResult.value = r
      } else {
        if (actionType === 'recovery' && !selectedTarget.value) {
          lastResult.value = { success: false, message: '请选择要回复的己方角色' }
          return
        }
        const params: Record<string, any> = {}
        if (selectedTarget.value) params.targetCharUid = selectedTarget.value
        const r = await store.submitAction('playCard', { cardUid, params })
        lastResult.value = r
      }
      clearSelection()
      return
    }

    // Replenish
    if (actionType === 'replenish') {
      const r = await store.submitAction('playCard', {
        cardUid,
        params: { mode: replenishMode.value },
      })
      lastResult.value = r
      clearSelection()
      return
    }

    // Big block → no target
    const r = await store.submitAction('playCard', { cardUid })
    lastResult.value = r
    clearSelection()
    return
  }

  // ====== Strategy card ======
  if (card.category === 'strategy' || card._cat === 'strategy') {
    if (!cardUid) {
      lastResult.value = { success: false, message: '请从手牌中点击策略牌选择' }
      return
    }

    const params: Record<string, any> = {}
    if (selectedTarget.value) params.targetCharUid = selectedTarget.value
    if (selectedTargetPlayer.value) params.targetPlayerId = selectedTargetPlayer.value

    const r = await store.submitAction('playCard', { cardUid, params })
    lastResult.value = r
    clearSelection()
    return
  }
}
</script>

<style scoped>
.test-page {
  min-height: 100vh;
  background: #0d0d1a;
  color: #e0e0e0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
}

/* Header */
.test-header {
  background: #1a1a2e;
  border-bottom: 2px solid #e94560;
  padding: 10px 16px;
  flex-shrink: 0;
}

.test-title {
  font-size: 18px;
  font-weight: 800;
  color: #e94560;
  margin: 0 0 8px;
}

.test-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.game-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #aaa;
}

.game-over {
  color: #f5a623;
  font-weight: bold;
}

/* Buttons */
.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-primary { background: #e94560; color: #fff; }
.btn-green { background: #22c55e; color: #fff; }
.btn-yellow { background: #f5a623; color: #000; }
.btn-red { background: #dc2626; color: #fff; }
.btn-purple { background: #8b5cf6; color: #fff; }
.btn-gray { background: #444; color: #ccc; }
.btn-orange { background: #f97316; color: #fff; }
.btn-cyan { background: #06b6d4; color: #fff; }
.btn-tiny { padding: 2px 8px; font-size: 11px; background: #555; color: #ccc; }

.action-divider {
  width: 1px;
  background: #444;
  margin: 0 4px;
}

.auto-battle-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #06b6d4;
  font-weight: 600;
}

/* Body layout */
.test-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left panel */
.card-panel {
  width: 260px;
  background: #12121f;
  border-right: 1px solid #2a2a40;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: #888;
  margin: 0;
  padding: 10px 12px 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.card-filter {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 3px 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: transparent;
  color: #aaa;
  font-size: 11px;
  cursor: pointer;
}

.filter-btn.active {
  background: #e94560;
  color: #fff;
  border-color: #e94560;
}

.card-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  margin-bottom: 2px;
}

.card-item:hover {
  background: rgba(233, 69, 96, 0.1);
}

.card-item-selected {
  background: rgba(233, 69, 96, 0.25) !important;
  border-left: 3px solid #e94560;
}

.card-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-item-name {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-item-id {
  font-size: 10px;
  color: #666;
}

.card-item-type {
  font-size: 10px;
  color: #888;
  background: #1a1a2e;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Center panel */
.game-panel {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* Action panel */
.action-panel {
  background: #1a1a2e;
  border: 1px solid #e94560;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.action-title {
  font-size: 15px;
  font-weight: 700;
  color: #f5a623;
  margin: 0 0 6px;
}

.action-desc {
  font-size: 13px;
  color: #aaa;
  margin: 0 0 4px;
}

.action-type-hint {
  font-size: 11px;
  color: #666;
  margin: 0 0 10px;
}

.action-type-hint code {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

.target-select {
  margin-bottom: 10px;
}

.target-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.target-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.target-btn {
  padding: 4px 10px;
  border: 1px solid #444;
  border-radius: 5px;
  background: #222;
  color: #ccc;
  font-size: 12px;
  cursor: pointer;
}

.target-btn:hover {
  border-color: #e94560;
}

.target-btn.active {
  background: #e94560;
  color: #fff;
  border-color: #e94560;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

/* Players grid */
.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.player-card {
  background: #14142a;
  border: 1px solid #2a2a40;
  border-radius: 10px;
  padding: 10px;
}

.player-current {
  border-color: #e94560;
  box-shadow: 0 0 12px rgba(233, 69, 96, 0.2);
}

.player-dead {
  opacity: 0.5;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.player-name {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
}

.player-hp {
  color: #ff6b81;
  font-size: 13px;
  font-weight: 600;
}

.player-retired {
  color: #666;
  font-size: 12px;
}

/* Deployed characters */
.deployed-area {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.deploy-slot {
  width: 120px;
  min-height: 100px;
}

.deployed-char {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 11px;
}

.char-near-death {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.char-retired {
  opacity: 0.4;
}

.char-name {
  font-weight: 700;
  color: #60a5fa;
  font-size: 12px;
  margin-bottom: 3px;
}

.char-stats {
  display: flex;
  gap: 6px;
  margin-bottom: 2px;
}

.stat-hp { color: #ff6b81; }
.stat-atk { color: #f5a623; }
.stat-armor { color: #60a5fa; }

.char-state {
  font-size: 10px;
  color: #888;
}

.char-keywords {
  font-size: 10px;
  color: #a78bfa;
}

.char-buffs, .char-debuffs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.buff-tag {
  font-size: 9px;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 1px 4px;
  border-radius: 3px;
}

.debuff-tag {
  font-size: 9px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 1px 4px;
  border-radius: 3px;
}

.char-equip {
  font-size: 10px;
  color: #f5a623;
  margin-top: 2px;
}

.deploy-empty {
  background: #111;
  border: 1px dashed #333;
  border-radius: 8px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
  font-size: 12px;
}

/* Hand */
.hand-area {
  margin-bottom: 6px;
}

.hand-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 3px;
}

.hand-cards {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.hand-card-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  background: #222;
  border: 1px solid #333;
  color: #ccc;
  transition: border-color 0.1s;
}

.hand-card-tag:hover {
  border-color: #e94560;
}

.hc-char { border-color: #60a5fa; color: #60a5fa; }
.hc-action { border-color: #e94560; color: #e94560; }
.hc-strategy { border-color: #22c55e; color: #22c55e; }

/* Piles */
.pile-info {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #555;
}

/* Decks */
.decks-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
  padding: 8px 0;
}

/* Pending effects */
.pending-effects {
  background: #1a1a2e;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;
}

.pending-effects h3 {
  font-size: 13px;
  color: #f59e0b;
  margin: 0 0 6px;
}

.pending-item {
  font-size: 11px;
  color: #aaa;
  padding: 2px 0;
}

/* Right panel */
.log-panel {
  width: 320px;
  background: #12121f;
  border-left: 1px solid #2a2a40;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}

.result-box {
  margin: 0 8px 10px;
  padding: 10px;
  border-radius: 8px;
  font-size: 11px;
  max-height: 200px;
  overflow-y: auto;
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid #22c55e;
  color: #22c55e;
}

.result-fail {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  color: #ef4444;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.log-entry {
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px solid #1a1a2e;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.log-turn { color: #666; }
.log-phase { color: #8b5cf6; }
.log-player { color: #60a5fa; }
.log-action { color: #ddd; }
.log-details { color: #888; width: 100%; font-size: 10px; }

.error-box {
  margin: 0 8px;
  padding: 8px;
  font-size: 12px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
}

.error-box.empty {
  color: #444;
  background: transparent;
}

/* Batch test */
.btn-pink { background: #ec4899; color: #fff; }

.batch-select {
  padding: 4px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
  color: #ccc;
  font-size: 12px;
}

.batch-params {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.param-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #aaa;
}

.param-input {
  width: 60px;
  padding: 3px 6px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
  color: #ccc;
  font-size: 12px;
  text-align: center;
}

.param-input:focus {
  outline: none;
  border-color: #ec4899;
}

/* Number input spin buttons */
.param-input[type="number"]::-webkit-inner-spin-button,
.param-input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  height: 24px;
  filter: invert(1);
}

.param-input[type="number"]::-webkit-inner-spin-button {
  background: #333;
  border-radius: 3px;
  border: 1px solid #555;
}

/* Stats panel */
.stats-panel {
  background: #1a1a2e;
  border: 2px solid #ec4899;
  border-radius: 10px;
  padding: 16px;
  margin-top: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: #14142a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: #ec4899;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: #888;
}

.text-yellow { color: #f59e0b; }
.text-red { color: #ef4444; }

.stats-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.stats-section h3 {
  font-size: 14px;
  font-weight: 700;
  color: #f5a623;
  margin: 0 0 10px;
}

.win-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.win-player {
  width: 80px;
  font-size: 12px;
  color: #ccc;
  flex-shrink: 0;
}

.win-bar-track {
  flex: 1;
  height: 20px;
  background: #222;
  border-radius: 4px;
  overflow: hidden;
}

.win-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ec4899, #f59e0b);
  border-radius: 4px;
  transition: width 0.3s;
}

.win-count {
  width: 120px;
  font-size: 12px;
  color: #aaa;
  text-align: right;
}

.card-usage-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-usage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #14142a;
  border-radius: 4px;
}

.card-usage-name {
  font-size: 12px;
  color: #ccc;
}

.card-usage-count {
  font-size: 12px;
  color: #ec4899;
  font-weight: 600;
}

.count-zero {
  color: #666;
}

.winner-char {
  background: #1a1a3a;
  border-left: 3px solid #10b981;
}

.clickable-title {
  cursor: pointer;
  user-select: none;
}

.clickable-title:hover {
  color: #fbbf24;
}

.toggle-icon {
  font-size: 10px;
  margin-left: 4px;
}

.usage-group {
  margin-bottom: 12px;
}

.usage-group-title {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  margin: 0 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px dashed #333;
}

.unused-cards-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.unused-card-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  border-radius: 4px;
  color: #ef4444;
}

.battle-details-list {
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
}

.battle-details-header {
  display: flex;
  padding: 4px 8px;
  background: #222;
  border-radius: 4px 4px 0 0;
  font-weight: 700;
  color: #888;
  position: sticky;
  top: 0;
}

.battle-detail-row {
  display: flex;
  padding: 3px 8px;
  border-bottom: 1px solid #1a1a2e;
}

.battle-detail-row:nth-child(odd) {
  background: #14142a;
}

.bd-timeout { color: #f59e0b; }
.bd-error { color: #ef4444; }

.bd-col { flex-shrink: 0; }
.bd-idx { width: 40px; text-align: center; }
.bd-turns { width: 60px; text-align: center; }
.bd-result { flex: 1; }

.error-list {
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  font-size: 11px;
  padding: 4px 8px;
  margin-bottom: 4px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 4px;
  color: #ef4444;
}

.error-more {
  font-size: 11px;
  color: #888;
  text-align: center;
  padding: 4px;
}
</style>
