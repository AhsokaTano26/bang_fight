<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CHARACTER_CARDS, ACTION_CARDS, STRATEGY_CARDS } from '../types/cards-data'
import type { CharacterCard, ActionCard, StrategyCard } from '../types/card'

// ---- State ----
const activeTab = ref<'character' | 'action' | 'strategy' | 'rules'>('character')
const sortBy = ref<'name' | 'hp' | 'attack' | 'winRate'>('name')
const filterFaction = ref<string>('all')
const filterType = ref<string>('all')
const searchQuery = ref('')
const previewImage = ref<string | null>(null)

// Test data
const testData = ref<any>(null)
const testDataLoaded = ref(false)

// Navigation
function goBack() {
  window.location.hash = ''
}

// Load test data
onMounted(async () => {
  try {
    const res = await fetch('/test-results.json')
    if (res.ok) {
      testData.value = await res.json()
      testDataLoaded.value = true
    }
  } catch {
    // Test data not available
  }
})

// ---- Computed ----
const faucets = [
  { key: 'AG', label: 'AG' },
  { key: 'HHW', label: 'HHW' },
  { key: 'PAS', label: 'PAS' },
  { key: 'PPP', label: 'PPP' },
  { key: 'ROS', label: 'ROS' },
]
const factionNames: Record<string, string> = {
  AG: 'Afterglow',
  HHW: 'Hello, Happy World!',
  PAS: 'Pastel*Palettes',
  PPP: 'Poppin\'Party',
  ROS: 'Roselia',
}
const factionColors: Record<string, string> = {
  AG: '#ff4444',
  HHW: '#ffaa00',
  PAS: '#ff88cc',
  PPP: '#ff6699',
  ROS: '#6666ff',
}

const actionTypes: Record<string, string> = {
  attack: '肘(普通攻击)',
  armorPierce: '破(破甲攻击)',
  bigBlock: '防(大格挡)',
  smallBlock: '挡(小格挡)',
  recovery: '小回复',
  bigRecovery: '大回复',
  replenish: '补充',
}

const strategyTypes: Record<string, string> = {
  deployable: '道具牌',
  instant: '即时牌',
}

// Winner characters data
const winnerChars = computed(() => {
  if (!testData.value?.winnerCharacters) return {}
  return testData.value.winnerCharacters
})

const totalGames = computed(() => {
  if (!testData.value?.stats?.completed) return 1
  return testData.value.stats.completed
})

// Card usage data
const cardUsage = computed(() => {
  if (!testData.value?.usedCards) return {}
  const map: Record<string, number> = {}
  for (const [name, count] of testData.value.usedCards) {
    map[name] = count
  }
  return map
})

// Character cards with stats
const characters = computed(() => {
  let list = CHARACTER_CARDS.map(c => {
    const winCount = winnerChars.value[c.id] || 0
    const winRate = ((winCount / totalGames.value) * 100).toFixed(1)
    const usageCount = cardUsage.value[c.name] || 0
    return { ...c, winCount, winRate: parseFloat(winRate), usageCount }
  })

  if (filterFaction.value !== 'all') {
    list = list.filter(c => c.faction === filterFaction.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.skills.some(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    )
  }

  if (sortBy.value === 'hp') list.sort((a, b) => b.maxHp - a.maxHp)
  else if (sortBy.value === 'attack') list.sort((a, b) => b.attack - a.attack)
  else if (sortBy.value === 'winRate') list.sort((a, b) => b.winRate - a.winRate)
  else list.sort((a, b) => a.id.localeCompare(b.id))

  return list
})

// Action cards grouped
const actionGroups = computed(() => {
  const groups: Record<string, { name: string; type: string; count: number; cards: ActionCard[]; usage: number; description: string; note: string; imageFile: string }> = {}
  for (const card of ACTION_CARDS) {
    const key = card.name
    if (!groups[key]) {
      groups[key] = {
        name: card.name,
        type: card.actionType,
        count: 0,
        cards: [],
        usage: cardUsage.value[card.name] || 0,
        description: getActionDescription(card),
        note: getActionNote(card),
        imageFile: card.imageFile,
      }
    }
    groups[key].count++
    groups[key].cards.push(card)
  }
  return Object.values(groups).sort((a, b) => {
    const order = ['攻击', '破甲攻击', '格挡', '防御', '回复', '回复大', '补充']
    const ai = order.indexOf(a.name)
    const bi = order.indexOf(b.name)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return b.usage - a.usage
  })
})

// Strategy cards
const strategies = computed(() => {
  let list = STRATEGY_CARDS.map(c => ({
    ...c,
    usage: cardUsage.value[c.name] || 0,
    typeLabel: strategyTypes[c.strategyType] || c.strategyType,
  }))

  if (filterType.value !== 'all') {
    list = list.filter(c => c.strategyType === filterType.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    )
  }

  // Group by name and aggregate usage
  const groupMap: Record<string, { name: string; id: string; type: string; typeLabel: string; count: number; usage: number; description: string; imageFile: string }> = {}
  for (const c of list) {
    if (!groupMap[c.name]) {
      groupMap[c.name] = {
        name: c.name,
        id: c.id,
        type: c.strategyType,
        typeLabel: c.typeLabel,
        count: 0,
        usage: c.usage,
        description: c.description || '',
        imageFile: c.imageFile,
      }
    }
    groupMap[c.name].count++
    groupMap[c.name].usage += c.usage
  }

  return Object.values(groupMap).sort((a, b) => b.usage - a.usage)
})

function getActionDescription(card: ActionCard): string {
  const descs: Record<string, string> = {
    attack: '对目标造成等于使用者基础攻击力的伤害',
    armorPierce: '无视格挡和护甲抵消，造成伤害',
    bigBlock: '保护己方所有部署角色，各抵挡一次伤害(即时触发，不保留)',
    smallBlock: '保护己方一名角色，抵挡一次伤害(即时触发，不保留)',
    recovery: '恢复角色行动点和血量变为正常状态；或恢复玩家2点体力值',
    bigRecovery: '恢复所有部署角色行动点和血量变为正常状态；或恢复玩家5点体力值',
    replenish: '从牌堆摸2张牌；或消耗3点体力值补充1名角色进入手牌(每回合限2次)',
  }
  return descs[card.actionType] || ''
}

function getActionNote(card: ActionCard): string {
  const notes: Record<string, string> = {
    attack: '消耗攻击角色的行动点',
    armorPierce: '消耗攻击角色的行动点',
    bigBlock: '消耗行动点(无行动点的角色可消耗队友的)',
    smallBlock: '消耗行动点(无行动点的角色可消耗队友的)',
    recovery: '回复角色不能让本回合已用行动点的角色继续行动；回复玩家体力可在非己方回合使用',
    bigRecovery: '同小回复，但作用于全体/更多体力值',
    replenish: '角色牌不占手牌上限',
  }
  return notes[card.actionType] || ''
}

function getStrategyCardsByName(name: string) {
  return STRATEGY_CARDS.filter(c => c.name === name)
}

function getKeywordLabel(kw: string): string {
  const labels: Record<string, string> = {
    guardian: '守护',
    counter: '反击',
    aoeAttack: '群攻',
    veteran: '历战',
    immunity: '免伤',
    untargetable: '不可选中',
    earthStore: '地藏',
    spread: '扩散',
    armorPierce: '穿甲',
    silenceImmunity: '沉默免疫',
    ignoreGuardian: '无视守护',
    counterSilence: '反击沉默',
  }
  return labels[kw] || kw
}

function getKeywordDesc(kw: string): string {
  const descs: Record<string, string> = {
    guardian: '对方攻击时必须优先攻击带有该词条的角色',
    counter: '被指定为攻击对象时，可对攻击发起者进行一次普通攻击',
    aoeAttack: '攻击属于群攻，能对一名玩家的所有部署角色造成伤害',
    veteran: '回合开始前角色从前一回合的濒死状态存活，攻击力永久+1，退场后清零',
    immunity: '可免疫一次即将到来的伤害',
    untargetable: '策略牌、行动牌和角色技能无法选定拥有该效果的角色',
    earthStore: '翻到背面表示该状态，相当于不在场，任何效果不影响该角色，但道具仍有效',
    spread: '攻击会影响到指定角色两旁部署的友方角色',
    armorPierce: '无视格挡和护甲抵消',
  }
  return descs[kw] || ''
}

function getKeywordColor(kw: string): string {
  const colors: Record<string, string> = {
    guardian: '#4a9eff',
    counter: '#ff6b6b',
    aoeAttack: '#ff9f43',
    veteran: '#a55eea',
    immunity: '#26de81',
    untargetable: '#778ca3',
    earthStore: '#fed330',
    spread: '#fd79a8',
    armorPierce: '#e17055',
  }
  return colors[kw] || '#888'
}

function getWinRateColor(rate: number): string {
  if (rate >= 20) return '#26de81'
  if (rate >= 15) return '#4a9eff'
  if (rate >= 10) return '#fed330'
  if (rate >= 5) return '#ff9f43'
  return '#fc5c65'
}

function getTierLabel(rate: number): string {
  if (rate >= 20) return 'S'
  if (rate >= 15) return 'A'
  if (rate >= 10) return 'B'
  if (rate >= 5) return 'C'
  return 'D'
}

function getTierColor(rate: number): string {
  if (rate >= 20) return '#ff4444'
  if (rate >= 15) return '#ff9f43'
  if (rate >= 10) return '#fed330'
  if (rate >= 5) return '#4a9eff'
  return '#fc5c65'
}
</script>

<template>
  <div class="gallery-page">
    <!-- Header -->
    <header class="gallery-header">
      <div class="header-top">
        <h1 class="gallery-title">邦邦武斗传 - 卡牌图鉴</h1>
        <a href="#" class="back-link" @click.prevent="goBack">返回游戏</a>
      </div>

      <!-- Tabs -->
      <nav class="tab-nav">
        <button
          v-for="tab in [
            { key: 'rules', label: '规则概要' },
            { key: 'character', label: '角色牌', count: CHARACTER_CARDS.length },
            { key: 'action', label: '行动牌', count: ACTION_CARDS.length },
            { key: 'strategy', label: '策略牌', count: STRATEGY_CARDS.length },
          ]"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }} <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
        </button>
      </nav>

      <!-- Filters -->
      <div class="filter-bar" v-if="activeTab !== 'rules'">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索卡牌名称/ID/技能..."
            class="search-input"
          />
        </div>

        <template v-if="activeTab === 'character'">
          <div class="filter-group">
            <span class="filter-label">阵营:</span>
            <button
              v-for="f in [{ key: 'all', label: '全部' }, ...faucets]"
              :key="f.key"
              class="filter-chip"
              :class="{ active: filterFaction === f.key }"
              :style="f.key !== 'all' && filterFaction === f.key ? { background: factionColors[f.key] } : {}"
              @click="filterFaction = f.key"
            >
              {{ f.label }}
            </button>
          </div>
          <div class="filter-group">
            <span class="filter-label">排序:</span>
            <button
              v-for="s in [
                { key: 'name', label: 'ID' },
                { key: 'hp', label: 'HP' },
                { key: 'attack', label: '攻击' },
                { key: 'winRate', label: '胜率' },
              ]"
              :key="s.key"
              class="filter-chip"
              :class="{ active: sortBy === s.key }"
              @click="sortBy = s.key as any"
            >
              {{ s.label }}
            </button>
          </div>
        </template>

        <template v-if="activeTab === 'strategy'">
          <div class="filter-group">
            <span class="filter-label">类型:</span>
            <button
              v-for="t in [
                { key: 'all', label: '全部' },
                { key: 'deployable', label: '道具牌' },
                { key: 'instant', label: '即时牌' },
              ]"
              :key="t.key"
              class="filter-chip"
              :class="{ active: filterType === t.key }"
              @click="filterType = t.key"
            >
              {{ t.label }}
            </button>
          </div>
        </template>
      </div>
    </header>

    <!-- Content -->
    <main class="gallery-body">

      <!-- ===== Rules Summary ===== -->
      <div v-if="activeTab === 'rules'" class="rules-section">
        <div class="rules-grid">
          <!-- Game flow -->
          <div class="rule-card">
            <h3 class="rule-title">对局流程</h3>
            <div class="rule-content">
              <div class="flow-step"><span class="step-num">1</span><b>判定阶段</b> — 花色判定、种类判定、概率判定(骰子)</div>
              <div class="flow-step"><span class="step-num">2</span><b>摸牌阶段</b> — 摸2张牌，刷新角色行动点和血量状态</div>
              <div class="flow-step"><span class="step-num">3</span><b>行动阶段</b> — 部署角色、使用行动牌/技能、使用策略牌</div>
              <div class="flow-step"><span class="step-num">4</span><b>弃牌阶段</b> — 手牌上限5张(角色牌不占手牌上限)</div>
              <div class="flow-step"><span class="step-num">5</span><b>回合结束</b> — 轮到下一名玩家</div>
            </div>
          </div>

          <!-- Character mechanics -->
          <div class="rule-card">
            <h3 class="rule-title">角色机制</h3>
            <div class="rule-content">
              <div class="rule-item"><b>血量(HP)</b>：三种状态：正常、濒死(卡牌180度倒置)、退场</div>
              <div class="rule-item"><b>基础攻击力</b>：使用行动牌时造成的伤害</div>
              <div class="rule-item"><b>行动点</b>：每名角色每回合1点，消耗后横置表示</div>
              <div class="rule-item"><b>濒死</b>：不提供行动点；己方回合开始时自动恢复为正常状态</div>
              <div class="rule-item"><b>部署上限</b>：最多5名角色；手牌里的角色牌不占手牌上限</div>
            </div>
          </div>

          <!-- Player HP -->
          <div class="rule-card">
            <h3 class="rule-title">玩家体力值</h3>
            <div class="rule-content">
              <div class="rule-item">初始<b>10点</b>，部署角色为0时才能被直接攻击</div>
              <div class="rule-item">体力值归零后只要场上还有角色就能继续游戏</div>
              <div class="rule-item">体力值归零后不能恢复体力值</div>
              <div class="rule-item">消耗<b>3点</b>体力值可补充1名角色进入手牌(每回合限2次)</div>
            </div>
          </div>

          <!-- Damage -->
          <div class="rule-card">
            <h3 class="rule-title">伤害判定</h3>
            <div class="rule-content">
              <div class="rule-item"><b>伤害 > HP</b>：角色退场</div>
              <div class="rule-item"><b>伤害 ≤ HP</b>：概率判定进入濒死</div>
              <div class="rule-item">差值 > 6：1/6概率濒死(骰到6)</div>
              <div class="rule-item">差值 4-6：1/3概率濒死(骰到5-6)</div>
              <div class="rule-item">差值 1-3：1/2概率濒死(骰到4-5-6)</div>
              <div class="rule-item"><b>濒死状态受到任意伤害直接退场</b></div>
            </div>
          </div>

          <!-- Action cards -->
          <div class="rule-card">
            <h3 class="rule-title">行动牌说明</h3>
            <div class="rule-content">
              <div class="rule-item"><b>肘(攻击)</b>：造成等于使用者攻击力的伤害，消耗攻击角色行动点</div>
              <div class="rule-item"><b>破(破甲)</b>：无视格挡和护甲抵消，消耗攻击角色行动点</div>
              <div class="rule-item"><b>挡(小格挡)</b>：保护一名角色抵挡一次伤害，消耗行动点</div>
              <div class="rule-item"><b>防(大格挡)</b>：保护所有部署角色各抵挡一次伤害，消耗行动点</div>
              <div class="rule-item"><b>小回复</b>：恢复一名角色行动点和血量为正常状态；或恢复玩家2点体力</div>
              <div class="rule-item"><b>大回复</b>：恢复所有部署角色行动点和血量为正常状态；或恢复玩家5点体力</div>
              <div class="rule-item"><b>补充</b>：摸2张牌；或消耗3点体力补充1名角色(每回合限2次)</div>
              <div class="rule-item">格挡消耗行动点：无行动点的角色可消耗队友的行动点来格挡</div>
              <div class="rule-item">手牌中至多只有3张角色牌</div>
            </div>
          </div>

          <!-- Negative effects -->
          <div class="rule-card">
            <h3 class="rule-title">负面效果</h3>
            <div class="rule-content">
              <div class="rule-item"><b>跳过摸牌</b>：不能摸牌，直接进入行动阶段</div>
              <div class="rule-item"><b>跳过行动</b>：摸牌后直接跳到弃牌阶段</div>
              <div class="rule-item"><b>失去行动能力</b>：己方回合内外都失去操作能力</div>
              <div class="rule-item"><b>破甲</b>：无视格挡和护甲抵消</div>
              <div class="rule-item"><b>缴械</b>：道具槽里的道具牌失效</div>
              <div class="rule-item"><b>虚弱</b>：角色血量减半(四舍五入)</div>
              <div class="rule-item"><b>沉默</b>：角色无法使用自身技能</div>
            </div>
          </div>

          <!-- Keywords -->
          <div class="rule-card rule-card-wide">
            <h3 class="rule-title">角色词条</h3>
            <div class="rule-keywords-grid">
              <div v-for="kw in ['guardian','counter','aoeAttack','veteran','immunity','untargetable','earthStore','spread','armorPierce']" :key="kw" class="rule-kw-item">
                <span class="keyword-tag" :style="{ background: getKeywordColor(kw) + '22', color: getKeywordColor(kw), borderColor: getKeywordColor(kw) + '44' }">
                  {{ getKeywordLabel(kw) }}
                </span>
                <span class="rule-kw-desc">{{ getKeywordDesc(kw) }}</span>
              </div>
            </div>
          </div>

          <!-- Win conditions -->
          <div class="rule-card">
            <h3 class="rule-title">胜利条件</h3>
            <div class="rule-content">
              <div class="rule-item"><b>常规胜利</b>：全场只剩1名未出局玩家</div>
              <div class="rule-item"><b>全灭胜利</b>：全员出局，最后造成此结果的玩家获胜</div>
              <div class="rule-item"><b>玩家出局</b>：体力值归零且场上无部署角色</div>
            </div>
          </div>

          <!-- Strategy cards -->
          <div class="rule-card">
            <h3 class="rule-title">策略牌</h3>
            <div class="rule-content">
              <div class="rule-item"><b>道具牌(可部署)</b>：为角色提供长期加成，部署上限=已部署角色数(最大5)</div>
              <div class="rule-item"><b>即时牌</b>：即时触发效果，大部分只能在己方回合使用</div>
              <div class="rule-item">角色退场时，若无空闲道具槽，该角色的道具被弃置</div>
            </div>
          </div>

          <!-- Faction skills -->
          <div class="rule-card">
            <h3 class="rule-title">阵营技</h3>
            <div class="rule-content">
              <div class="rule-item">己方场上5名角色必须是同阵营才能触发</div>
              <div class="rule-item">两个玩家凑齐相同阵营时，先凑齐的玩家使用</div>
              <div class="rule-item">地藏状态的角色会破坏阵营技触发</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Character Cards ===== -->
      <div v-if="activeTab === 'character'" class="card-grid">
        <div
          v-for="char in characters"
          :key="char.id"
          class="char-card"
          :style="{ borderColor: factionColors[char.faction] }"
        >
          <!-- Card image -->
          <div class="card-img-wrapper" @click="previewImage = '/' + char.imageFile">
            <img :src="'/' + char.imageFile" :alt="char.name" class="card-img" loading="lazy" />
            <div class="card-img-overlay">点击查看大图</div>
          </div>

          <!-- Card header -->
          <div class="char-header" :style="{ background: factionColors[char.faction] + '22' }">
            <div class="char-id">{{ char.id }}</div>
            <div class="char-name">{{ char.name }}</div>
            <div class="char-faction" :style="{ color: factionColors[char.faction] }">
              {{ factionNames[char.faction] }}
            </div>
          </div>

          <!-- Stats -->
          <div class="char-stats">
            <div class="stat-item">
              <span class="stat-label">HP</span>
              <span class="stat-value hp">{{ char.maxHp }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">ATK</span>
              <span class="stat-value atk">{{ char.attack }}</span>
            </div>
            <div class="stat-item" v-if="testDataLoaded">
              <span class="stat-label">胜率</span>
              <span class="stat-value" :style="{ color: getWinRateColor(char.winRate) }">
                {{ char.winRate }}%
              </span>
            </div>
            <div class="stat-item" v-if="testDataLoaded">
              <span class="stat-label">Tier</span>
              <span class="stat-value tier" :style="{ color: getTierColor(char.winRate) }">
                {{ getTierLabel(char.winRate) }}
              </span>
            </div>
          </div>

          <!-- Keywords -->
          <div class="char-keywords" v-if="char.keywords.length > 0">
            <span
              v-for="kw in char.keywords"
              :key="kw"
              class="keyword-tag"
              :title="getKeywordDesc(kw)"
              :style="{ background: getKeywordColor(kw) + '22', color: getKeywordColor(kw), borderColor: getKeywordColor(kw) + '44' }"
            >
              {{ getKeywordLabel(kw) }}
            </span>
          </div>

          <!-- Skills -->
          <div class="char-skills">
            <div v-for="skill in char.skills" :key="skill.name" class="skill-item">
              <div class="skill-header">
                <span class="skill-name">{{ skill.name }}</span>
                <span v-if="skill.consumeActionPoint" class="skill-ap">消耗行动点</span>
                <span v-else class="skill-passive">被动</span>
              </div>
              <div class="skill-desc">{{ skill.description }}</div>
            </div>
          </div>

          <!-- Win bar -->
          <div class="win-bar-container" v-if="testDataLoaded && char.winCount > 0">
            <div class="win-bar" :style="{ width: (char.winRate / 25 * 100) + '%', background: getWinRateColor(char.winRate) }"></div>
          </div>
        </div>
      </div>

      <!-- ===== Action Cards ===== -->
      <div v-if="activeTab === 'action'">
        <!-- Group header info -->
        <div class="action-groups">
          <div v-for="group in actionGroups" :key="group.name" class="action-group-section">
            <div class="group-header">
              <span class="group-name">{{ group.name }}</span>
              <span class="group-type">{{ actionTypes[group.type] }}</span>
              <span class="group-count">x{{ group.count }}</span>
              <span class="group-desc">{{ group.description }}</span>
              <span class="group-usage" v-if="testDataLoaded">AI使用: {{ group.usage.toLocaleString() }}</span>
            </div>
            <div class="card-img-grid">
              <div
                v-for="card in group.cards"
                :key="card.id"
                class="card-img-cell"
                @click="previewImage = '/' + card.imageFile"
              >
                <img :src="'/' + card.imageFile" :alt="card.name" class="cell-img" loading="lazy" />
                <div class="cell-id">{{ card.id }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Strategy Cards ===== -->
      <div v-if="activeTab === 'strategy'">
        <div class="strategy-groups">
          <div v-for="card in strategies" :key="card.id" class="strategy-group-section">
            <div class="group-header">
              <span class="group-name">{{ card.name }}</span>
              <span class="strategy-type-badge" :class="card.type">{{ card.typeLabel }}</span>
              <span class="group-count">x{{ card.count }}</span>
              <span class="group-desc">{{ card.description }}</span>
              <span class="group-usage" v-if="testDataLoaded">AI使用: {{ card.usage.toLocaleString() }}</span>
            </div>
            <div class="card-img-grid">
              <div
                v-for="c in getStrategyCardsByName(card.name)"
                :key="c.id"
                class="card-img-cell"
                @click="previewImage = '/' + c.imageFile"
              >
                <img :src="'/' + c.imageFile" :alt="c.name" class="cell-img" loading="lazy" />
                <div class="cell-id">{{ c.id }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Test data indicator -->
    <div class="test-data-badge" v-if="testDataLoaded">
      数据来源: {{ totalGames }}场AI对战
    </div>

    <!-- Image preview modal -->
    <Teleport to="body">
      <div v-if="previewImage" class="preview-overlay" @click="previewImage = null">
        <img :src="previewImage" class="preview-img" @click.stop />
        <button class="preview-close" @click="previewImage = null">&times;</button>
      </div>
    </Teleport>
  </div>
</template>


<style scoped>
.gallery-page {
  height: 100vh;
  background: #0a0a1a;
  color: #e0e0e0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  overflow-y: auto;
}

/* ---- Header ---- */
.gallery-header {
  background: #12122a;
  border-bottom: 1px solid #2a2a4a;
  padding: 16px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.gallery-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.back-link {
  color: #4a9eff;
  text-decoration: none;
  font-size: 14px;
}
.back-link:hover { text-decoration: underline; }

/* Tabs */
.tab-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 8px 20px;
  border: 1px solid #2a2a4a;
  background: transparent;
  color: #888;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.tab-btn:hover { background: #1a1a3a; color: #ccc; }
.tab-btn.active {
  background: #2a2a6a;
  color: #fff;
  border-color: #4a4aff;
}
.tab-count {
  font-size: 12px;
  opacity: 0.6;
  margin-left: 4px;
}

/* Filters */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.search-box { flex: 1; min-width: 200px; }
.search-input {
  width: 100%;
  padding: 6px 12px;
  background: #1a1a3a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: #4a4aff; }
.search-input::placeholder { color: #555; }

.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
}
.filter-chip {
  padding: 4px 10px;
  border: 1px solid #2a2a4a;
  background: transparent;
  color: #888;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.filter-chip:hover { background: #1a1a3a; color: #ccc; }
.filter-chip.active {
  background: #2a2a6a;
  color: #fff;
  border-color: #4a4aff;
}

/* ---- Body ---- */
.gallery-body {
  padding: 20px 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ===== Rules Section ===== */
.rules-section {
  max-width: 1200px;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.rule-card {
  background: #12122a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 14px 18px;
}
.rule-card-wide {
  grid-column: 1 / -1;
}

.rule-title {
  font-size: 15px;
  font-weight: 700;
  color: #4a9eff;
  margin: 0 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #2a2a4a;
}

.rule-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  font-size: 13px;
  color: #bbb;
  line-height: 1.5;
}
.rule-item b { color: #ddd; }

.flow-step {
  font-size: 13px;
  color: #bbb;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.flow-step b { color: #ddd; }
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: #4a9eff22;
  color: #4a9eff;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.rule-keywords-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}
.rule-kw-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.rule-kw-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}

/* ===== Character Grid ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.char-card {
  background: #12122a;
  border: 1px solid #2a2a4a;
  border-left: 4px solid;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}
.char-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.char-header {
  padding: 12px 14px 8px;
}
.char-id {
  font-size: 11px;
  color: #666;
  font-family: monospace;
}
.char-name {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 2px 0;
}
.char-faction {
  font-size: 12px;
  font-weight: 500;
}

/* Stats */
.char-stats {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  background: #0e0e22;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-label {
  font-size: 10px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
}
.stat-value.hp { color: #26de81; }
.stat-value.atk { color: #ff6b6b; }
.stat-value.tier {
  font-size: 18px;
  font-weight: 900;
}

/* Keywords */
.char-keywords {
  padding: 6px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.keyword-tag {
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: help;
}

/* Skills */
.char-skills {
  padding: 8px 14px;
}
.skill-item {
  margin-bottom: 6px;
}
.skill-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
}
.skill-ap {
  font-size: 10px;
  padding: 1px 5px;
  background: #ff6b6b33;
  color: #ff6b6b;
  border-radius: 4px;
  font-weight: 600;
}
.skill-passive {
  font-size: 10px;
  padding: 1px 5px;
  background: #26de8133;
  color: #26de81;
  border-radius: 4px;
  font-weight: 600;
}
.skill-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}

/* Win bar */
.win-bar-container {
  height: 4px;
  background: #1a1a3a;
}
.win-bar {
  height: 100%;
  border-radius: 0 2px 2px 0;
  transition: width 0.5s ease;
}

/* ===== Action & Strategy Card Grid ===== */
.action-groups,
.strategy-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-group-section,
.strategy-group-section {
  background: #12122a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 12px 16px;
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.group-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.group-type {
  font-size: 12px;
  color: #888;
}
.group-count {
  font-size: 14px;
  font-weight: 600;
  color: #4a9eff;
}
.group-desc {
  font-size: 12px;
  color: #888;
  flex: 1;
}
.group-usage {
  font-size: 12px;
  color: #fed330;
}

.strategy-type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.strategy-type-badge.deployable {
  background: #4a9eff22;
  color: #4a9eff;
}
.strategy-type-badge.instant {
  background: #ff9f4322;
  color: #ff9f43;
}

/* Card image grid */
.card-img-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-img-cell {
  width: 120px;
  cursor: pointer;
  transition: transform 0.15s;
}
.card-img-cell:hover {
  transform: scale(1.08);
}

.cell-img {
  width: 120px;
  aspect-ratio: 965 / 1378;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #2a2a4a;
  display: block;
  background: #0a0a1a;
}
.card-img-cell:hover .cell-img {
  border-color: #4a9eff;
  box-shadow: 0 2px 12px rgba(74, 158, 255, 0.3);
}

.cell-id {
  font-size: 10px;
  color: #555;
  text-align: center;
  margin-top: 2px;
  font-family: monospace;
}

/* Test data badge */
.test-data-badge {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: #1a1a3a;
  border: 1px solid #2a2a4a;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  color: #666;
}

/* Card image in character cards */
.card-img-wrapper {
  position: relative;
  cursor: pointer;
  overflow: hidden;
}
.card-img {
  width: 100%;
  aspect-ratio: 965 / 1378;
  object-fit: contain;
  display: block;
  transition: transform 0.2s;
  background: #0a0a1a;
}
.card-img-wrapper:hover .card-img {
  transform: scale(1.05);
}
.card-img-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 12px;
  text-align: center;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.card-img-wrapper:hover .card-img-overlay {
  opacity: 1;
}

/* Image preview modal */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}
.preview-img {
  max-width: 40vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  cursor: default;
}
.preview-close {
  position: absolute;
  top: 20px;
  right: 24px;
  background: none;
  border: none;
  color: #fff;
  font-size: 36px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.preview-close:hover {
  opacity: 1;
}
</style>
