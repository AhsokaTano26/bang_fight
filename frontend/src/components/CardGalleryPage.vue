<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { Eye, Search, X } from '@lucide/vue'
import {
  CARD_CATALOG,
  CARD_FACTIONS,
  CARD_PACK_VERSION,
  type CatalogEntry,
} from '../types/card-catalog.generated'
import PageHeader from './PageHeader.vue'
import CardPreviewDialog from './CardPreviewDialog.vue'

const emit = defineEmits<{ back: [] }>()

const collectionTabs = [
  {
    key: 'character',
    label: '角色',
    cards: CARD_CATALOG.filter((card) => card.category === 'character'),
  },
  {
    key: 'action',
    label: '行动',
    cards: CARD_CATALOG.filter((card) => card.category === 'action'),
  },
  {
    key: 'strategy',
    label: '道具与即时',
    cards: CARD_CATALOG.filter((card) => card.category === 'strategy'),
  },
  {
    key: 'auxiliary',
    label: '辅助',
    cards: CARD_CATALOG.filter((card) => card.category === 'auxiliary'),
  },
  {
    key: 'other',
    label: '状态与对战板',
    cards: CARD_CATALOG.filter(
      (card) => card.category === 'marker' || card.category === 'board',
    ),
  },
]

function tabFromHash() {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(
    'tab',
  ) === 'rules'
    ? 'rules'
    : 'character'
}

const activeTab = ref(tabFromHash())
const searchQuery = ref('')
const sortBy = ref('default')
const filterFaction = ref('all')
const filterType = ref('all')
const previewCardId = ref<string | null>(null)
const factionNames = Object.fromEntries(
  CARD_FACTIONS.map((faction) => [faction.id, faction.name]),
)
const factionCounts = Object.fromEntries(
  CARD_FACTIONS.map((faction) => [
    faction.id,
    collectionTabs[0]!.cards.filter((card) => card.faction === faction.id)
      .length,
  ]),
)

const actionTypes: Record<string, string> = {
  attack: '普通攻击',
  armorPierce: '破甲攻击',
  bigBlock: '大格挡',
  smallBlock: '小格挡',
  recovery: '小回复',
  bigRecovery: '大回复',
  replenish: '补充',
}
const strategyTypes: Record<string, string> = {
  deployable: '道具牌',
  instant: '即时牌',
}
const keywordRules = [
  {
    key: 'guardian',
    name: '守护',
    description: '对方攻击时，必须优先攻击带有该词条的角色。',
  },
  {
    key: 'counter',
    name: '反击',
    description: '被指定为攻击对象时，可对攻击发起者进行一次普通攻击。',
  },
  {
    key: 'aoeAttack',
    name: '群攻',
    description: '攻击能对一名玩家的所有部署角色造成伤害。',
  },
  {
    key: 'veteran',
    name: '历战',
    description: '从前一回合的濒死状态存活，攻击力永久 +1，退场后清零。',
  },
  { key: 'immunity', name: '免伤', description: '可免疫一次即将到来的伤害。' },
  {
    key: 'untargetable',
    name: '不可选中',
    description: '策略牌、行动牌和角色技能无法选定该角色。',
  },
  {
    key: 'earthStore',
    name: '地藏',
    description: '翻到背面，相当于不在场，任何效果不影响该角色，但道具仍有效。',
  },
  {
    key: 'spread',
    name: '扩散',
    description: '攻击会影响到指定角色两旁部署的友方角色。',
  },
  { key: 'armorPierce', name: '穿甲', description: '无视格挡和护甲抵消。' },
]
const keywordNames = Object.fromEntries(
  keywordRules.map((keyword) => [keyword.key, keyword.name]),
)

// Every printed asset keeps its own ID; same-named cards can have different effects.
const currentCollection = computed(() =>
  collectionTabs.find((tab) => tab.key === activeTab.value),
)
const filteredCards = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const cards = (currentCollection.value?.cards ?? []).filter((card) => {
    if (
      activeTab.value === 'character' &&
      filterFaction.value !== 'all' &&
      card.faction !== filterFaction.value
    )
      return false
    if (
      activeTab.value === 'strategy' &&
      filterType.value !== 'all' &&
      card.strategyType !== filterType.value
    )
      return false
    if (!query) return true
    return [
      card.id,
      card.name,
      card.description,
      card.faction,
      factionNames[card.faction ?? ''],
      card.attribute,
      cardTypeLabel(card),
      ...(card.keywords ?? []).map(
        (keyword) => keywordNames[keyword] ?? keyword,
      ),
      ...(card.skills ?? []).flatMap((skill) => [
        skill.name,
        skill.description,
      ]),
    ].some((value) => value?.toLocaleLowerCase().includes(query))
  })
  if (sortBy.value === 'name')
    return cards.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id),
    )
  if (sortBy.value === 'hp')
    return cards.sort(
      (a, b) => (b.maxHp ?? 0) - (a.maxHp ?? 0) || a.id.localeCompare(b.id),
    )
  if (sortBy.value === 'attack')
    return cards.sort(
      (a, b) => (b.attack ?? 0) - (a.attack ?? 0) || a.id.localeCompare(b.id),
    )
  return cards
})

watch(activeTab, (value) => {
  if (sortBy.value === 'hp' || sortBy.value === 'attack')
    sortBy.value = 'default'
  if (window.location.hash.startsWith('#/gallery')) {
    window.history.replaceState(
      null,
      '',
      value === 'rules' ? '#/gallery?tab=rules' : '#/gallery',
    )
  }
})

function syncHashTab() {
  if (window.location.hash.startsWith('#/gallery'))
    activeTab.value = tabFromHash()
}
onMounted(() => window.addEventListener('hashchange', syncHashTab))
onUnmounted(() => window.removeEventListener('hashchange', syncHashTab))

function cardTypeLabel(card: CatalogEntry): string {
  if (card.strategyType)
    return strategyTypes[card.strategyType] ?? card.strategyType
  if (card.actionType) return actionTypes[card.actionType] ?? card.actionType
  if (card.category === 'auxiliary') return '辅助牌'
  if (card.category === 'marker') return '状态标记'
  if (card.category === 'board') return '对战板'
  return ''
}

function resetFilters() {
  searchQuery.value = ''
  filterFaction.value = 'all'
  filterType.value = 'all'
  sortBy.value = 'default'
}

const turnSteps = [
  { title: '判定', description: '结算花色、种类与概率判定。' },
  { title: '摸牌', description: '摸 2 张牌，刷新角色行动点与血量状态。' },
  { title: '行动', description: '部署角色，使用行动牌、技能与策略牌。' },
  { title: '弃牌', description: '手牌上限 5 张，角色牌不占手牌上限。' },
  { title: '结束', description: '本回合结束，轮到下一名玩家。' },
]
const ruleSections = [
  {
    title: '角色与行动点',
    items: [
      ['血量', '角色分为正常、濒死与退场三种状态；濒死时将卡牌倒置。'],
      ['攻击力', '使用攻击行动牌时，造成等于角色基础攻击力的伤害。'],
      ['行动点', '每名角色每回合 1 点，消耗后横置；濒死角色不提供行动点。'],
      ['恢复', '己方回合开始时，濒死角色自动恢复为正常状态。'],
      ['部署', '场上最多 5 名角色，手牌中至多 3 张角色牌。'],
    ],
  },
  {
    title: '体力与胜负',
    items: [
      ['体力', '玩家初始 10 点体力，场上没有部署角色时才能被直接攻击。'],
      ['归零', '只要场上还有角色便可继续游戏；体力归零后不能恢复体力。'],
      ['补充角色', '消耗 3 点体力，将 1 名角色补充到手牌，每回合限 2 次。'],
      ['出局', '玩家体力归零，且场上没有部署角色。'],
      [
        '胜利',
        '全场只剩 1 名未出局玩家时获胜；全员出局时，最后造成此结果的玩家获胜。',
      ],
    ],
  },
  {
    title: '伤害与濒死',
    items: [
      ['伤害 > 血量', '角色直接退场。'],
      ['伤害 ≤ 血量', '通过概率判定决定是否进入濒死。'],
      ['差值 > 6', '骰到 6 时濒死，概率为 1/6。'],
      ['差值 4–6', '骰到 5–6 时濒死，概率为 1/3。'],
      ['差值 1–3', '骰到 4–6 时濒死，概率为 1/2。'],
      ['濒死受伤', '濒死角色受到任意伤害，直接退场。'],
    ],
  },
  {
    title: '行动牌',
    items: [
      [
        '肘 / 破',
        '肘造成普通攻击伤害；破无视格挡和护甲抵消，均消耗攻击角色行动点。',
      ],
      [
        '挡 / 防',
        '挡保护一名角色，防保护所有部署角色，各抵挡一次伤害，即时触发。',
      ],
      ['格挡消耗', '消耗行动点；没有行动点的角色可以消耗队友的行动点。'],
      ['小回复', '恢复一名角色行动点与血量为正常状态，或恢复玩家 2 点体力。'],
      [
        '大回复',
        '恢复所有部署角色行动点与血量为正常状态，或恢复玩家 5 点体力。',
      ],
      [
        '回复限制',
        '本回合已使用行动点的角色不能通过回复再次行动；回复玩家体力可在非己方回合使用。',
      ],
      ['补充', '摸 2 张牌，或消耗 3 点体力补充 1 名角色，每回合限 2 次。'],
    ],
  },
  {
    title: '道具与即时牌',
    items: [
      ['道具牌', '部署后提供长期加成，道具上限等于已部署角色数，最多 5 张。'],
      ['即时牌', '打出后立即结算效果，大部分只能在己方回合使用。'],
      ['角色退场', '若没有空闲道具槽，该角色的道具会被弃置。'],
      [
        '花色判定',
        'Happy（欢乐）：红心、方块；Powerful（强力）：黑桃；Pure（纯净）：梅花。',
      ],
    ],
  },
  {
    title: '负面效果',
    items: [
      ['跳过摸牌', '直接进入行动阶段。'],
      ['跳过行动', '摸牌后直接进入弃牌阶段。'],
      ['失去行动能力', '己方回合内外均失去操作能力。'],
      ['破甲', '无视格挡和护甲抵消。'],
      ['缴械', '道具槽内的道具牌失效。'],
      ['虚弱', '角色血量减半，四舍五入。'],
      ['沉默', '无法使用自身技能。'],
    ],
  },
  {
    title: '阵营技',
    items: [
      [
        '触发条件',
        '己方场上 5 名角色属于同一阵营；地藏状态的角色会破坏触发条件。',
      ],
      ['相同阵营', '两名玩家凑齐相同阵营时，由先凑齐的玩家使用。'],
      ['AG', '全体角色攻击力 +2。'],
      ['PPP', '全体角色回复 1 点血量。'],
      ['ROS', '对手全体角色攻击力 −1。'],
      ['HHW', '随机获得回血、加攻或摸牌效果。'],
      ['PAS', '每回合开始额外摸 1 张牌。'],
    ],
  },
]
</script>

<template>
  <div class="gallery-page">
    <PageHeader
      title="卡牌图鉴"
      :show-back="true"
      :active="activeTab === 'rules' ? 'rules' : 'gallery'"
      @back="emit('back')"
    />

    <main class="gallery-content">
      <div class="gallery-intro">
        <h1>卡牌图鉴</h1>
        <p>
          {{ collectionTabs[0]!.cards.length }} 张角色牌 ·
          {{ CARD_FACTIONS.length }} 个乐队
        </p>
      </div>

      <TabsRoot v-model="activeTab" class="catalog-tabs">
        <TabsList class="tab-list" aria-label="图鉴分类">
          <TabsTrigger
            v-for="tab in collectionTabs"
            :key="tab.key"
            :value="tab.key"
            class="tab-trigger"
          >
            {{ tab.label }}
            <span class="tab-count">{{ tab.cards.length }}</span>
          </TabsTrigger>
          <TabsTrigger value="rules" class="tab-trigger">规则</TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="tab in collectionTabs"
          :key="tab.key"
          :value="tab.key"
          class="tab-content"
        >
          <div
            class="catalog-layout"
            :class="{ 'with-factions': tab.key === 'character' }"
          >
            <aside
              v-if="tab.key === 'character'"
              class="faction-rail"
              aria-label="按乐队筛选"
            >
              <div class="faction-list">
                <button
                  type="button"
                  class="faction-filter"
                  :aria-pressed="filterFaction === 'all'"
                  @click="filterFaction = 'all'"
                >
                  <span>全部</span
                  ><span class="faction-count">{{ tab.cards.length }}</span>
                </button>
                <button
                  v-for="faction in CARD_FACTIONS"
                  :key="faction.id"
                  type="button"
                  class="faction-filter"
                  :aria-pressed="filterFaction === faction.id"
                  :title="faction.name"
                  @click="filterFaction = faction.id"
                >
                  <span>{{ faction.id }}</span
                  ><span class="faction-count">{{
                    factionCounts[faction.id]
                  }}</span>
                </button>
              </div>
            </aside>

            <section class="catalog-results" :aria-label="tab.label + '卡牌'">
              <div class="catalog-toolbar">
                <div class="search-field">
                  <Search :size="19" :stroke-width="1.6" aria-hidden="true" />
                  <label :for="'catalog-search-' + tab.key" class="sr-only"
                    >搜索{{ tab.label }}名称、编号或技能</label
                  >
                  <input
                    :id="'catalog-search-' + tab.key"
                    v-model="searchQuery"
                    type="search"
                    autocomplete="off"
                    placeholder="搜索名称、编号或技能"
                  />
                  <button
                    v-if="searchQuery"
                    type="button"
                    class="clear-search"
                    aria-label="清除搜索"
                    @click="searchQuery = ''"
                  >
                    <X :size="17" aria-hidden="true" />
                  </button>
                </div>
                <label :for="'catalog-sort-' + tab.key" class="sr-only"
                  >卡牌排序</label
                >
                <select
                  :id="'catalog-sort-' + tab.key"
                  v-model="sortBy"
                  class="sort-select"
                >
                  <option value="default">默认顺序</option>
                  <option value="name">名称排序</option>
                  <option v-if="tab.key === 'character'" value="hp">
                    血量从高到低
                  </option>
                  <option v-if="tab.key === 'character'" value="attack">
                    攻击从高到低
                  </option>
                </select>
              </div>

              <div class="results-meta">
                <div
                  v-if="tab.key === 'strategy'"
                  class="type-filters"
                  aria-label="策略牌类型"
                >
                  <button
                    v-for="type in [
                      { key: 'all', label: '全部' },
                      { key: 'deployable', label: '道具牌' },
                      { key: 'instant', label: '即时牌' },
                    ]"
                    :key="type.key"
                    type="button"
                    :aria-pressed="filterType === type.key"
                    @click="filterType = type.key"
                  >
                    {{ type.label }}
                  </button>
                </div>
                <p class="result-count" role="status" aria-live="polite">
                  显示 {{ filteredCards.length }} / {{ tab.cards.length }} 张
                </p>
              </div>

              <div v-if="filteredCards.length" class="card-grid">
                <button
                  v-for="card in filteredCards"
                  :key="card.id"
                  type="button"
                  class="catalog-card"
                  :aria-label="
                    '查看' + card.name + '，' + card.id + '的卡牌详情'
                  "
                  @click="previewCardId = card.id"
                >
                  <span class="card-image">
                    <img
                      :src="'/' + card.thumbnailFile"
                      :alt="card.name + '卡面'"
                      width="384"
                      height="536"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span class="card-heading">
                    <span class="card-title-group"
                      ><span class="card-name">{{ card.name }}</span
                      ><span class="card-id">{{ card.id }}</span></span
                    >
                    <span class="inspect-label"
                      ><Eye
                        :size="14"
                        :stroke-width="1.6"
                        aria-hidden="true"
                      /><span>查看</span></span
                    >
                  </span>
                  <span v-if="card.category === 'character'" class="card-stats">
                    <span
                      >VIT <strong>{{ card.maxHp }}</strong></span
                    ><span
                      >ATK <strong>{{ card.attack }}</strong></span
                    >
                    <span class="card-faction">乐队：{{ card.faction }}</span>
                  </span>
                  <span v-else class="card-kind"
                    ><span>{{ cardTypeLabel(card) }}</span
                    ><span v-if="card.attribute">{{
                      card.attribute
                    }}</span></span
                  >
                </button>
              </div>

              <div v-else class="empty-results">
                <Search :size="28" :stroke-width="1.5" aria-hidden="true" />
                <h2>没有找到匹配的卡牌</h2>
                <p>试试卡牌名称、编号或技能中的其他词语。</p>
                <button
                  type="button"
                  class="reset-button"
                  @click="resetFilters"
                >
                  重置搜索与筛选
                </button>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="rules" class="tab-content rules-content">
          <section class="turn-section" aria-labelledby="turn-heading">
            <div class="section-heading">
              <h2 id="turn-heading">一个回合，五个阶段</h2>
              <p>按顺序结算，再把舞台交给下一位玩家。</p>
            </div>
            <ol class="turn-steps">
              <li v-for="(step, index) in turnSteps" :key="step.title">
                <span class="step-number">0{{ index + 1 }}</span>
                <h3>{{ step.title }}</h3>
                <p>{{ step.description }}</p>
              </li>
            </ol>
          </section>
          <div class="rules-grid">
            <section
              v-for="section in ruleSections"
              :key="section.title"
              class="rule-section"
            >
              <h2>{{ section.title }}</h2>
              <dl>
                <div v-for="item in section.items" :key="item[0]">
                  <dt>{{ item[0] }}</dt>
                  <dd>{{ item[1] }}</dd>
                </div>
              </dl>
            </section>
            <section class="rule-section">
              <h2>角色词条</h2>
              <dl>
                <div v-for="keyword in keywordRules" :key="keyword.key">
                  <dt>{{ keyword.name }}</dt>
                  <dd>{{ keyword.description }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </TabsContent>
      </TabsRoot>

      <p class="pack-note">
        {{ CARD_PACK_VERSION }} ·
        收录完整新版卡面。对战沿用当前已支持的卡牌与规则。
      </p>
    </main>

    <CardPreviewDialog v-model:card-id="previewCardId" />
  </div>
</template>

<style scoped>
.gallery-page {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text);
}
.gallery-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 36px 40px 48px;
}
.gallery-intro h1 {
  margin: 0;
  font-size: clamp(32px, 3.2vw, 48px);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.2;
}
.gallery-intro p {
  margin: 10px 0 0;
  color: var(--text-dim);
  font-size: 16px;
}
.catalog-tabs {
  margin-top: 24px;
  min-width: 0;
}
.tab-list {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  scrollbar-width: thin;
}
.tab-trigger {
  position: relative;
  flex: 0 0 auto;
  min-height: 52px;
  padding: 10px 14px 14px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--text);
  font-size: 16px;
  white-space: nowrap;
  cursor: pointer;
}
.tab-trigger[data-state='active'] {
  border-bottom-color: var(--accent);
  color: var(--accent);
  font-weight: 650;
}
.tab-trigger:hover {
  color: var(--accent);
}
.tab-count {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.tab-content {
  padding-top: 28px;
}
.tab-content:focus-visible {
  outline-offset: 6px;
}
.catalog-layout {
  min-width: 0;
}
.catalog-layout.with-factions {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 28px;
}
.faction-rail {
  border-right: 1px solid var(--border);
  padding-right: 16px;
}
.faction-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.faction-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  min-height: 44px;
  padding: 10px 16px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.faction-filter[aria-pressed='true'] {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  font-weight: 650;
}
.faction-filter[aria-pressed='true']::before {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
  content: '';
}
.faction-filter:hover {
  background: color-mix(in srgb, var(--text) 4%, transparent);
}
.faction-count {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.catalog-results {
  min-width: 0;
}
.catalog-toolbar {
  display: flex;
  align-items: stretch;
  gap: 16px;
}
.search-field {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 46px;
  padding-left: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-dim);
}
.search-field:focus-within {
  border-color: var(--accent);
  outline: 2px solid color-mix(in srgb, var(--accent) 20%, transparent);
  outline-offset: 1px;
}
.search-field > svg {
  flex: 0 0 auto;
}
.search-field input {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 14px;
}
.search-field input::placeholder {
  color: var(--text-dim);
}
.search-field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}
.clear-search {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.clear-search:hover {
  color: var(--accent);
}
.sort-select {
  width: 220px;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.results-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 36px;
  margin-bottom: 8px;
}
.result-count {
  margin: 8px 0;
  color: var(--text-dim);
  font-size: 12px;
}
.type-filters {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.type-filters button {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.type-filters button[aria-pressed='true'] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  color: var(--accent);
  font-weight: 600;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 28px 20px;
}
.catalog-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 0 10px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.card-image {
  display: block;
  width: 100%;
  aspect-ratio: 869 / 1213;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  box-shadow: 0 2px 5px color-mix(in srgb, var(--text) 8%, transparent);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.card-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.catalog-card:hover .card-image {
  border-color: var(--accent);
  box-shadow: 0 3px 9px color-mix(in srgb, var(--text) 12%, transparent);
}
.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding-top: 10px;
}
.card-title-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.card-name {
  font-size: 15px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.card-id {
  color: var(--text-dim);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.inspect-label {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.5;
}
.catalog-card:hover .inspect-label {
  border-color: var(--accent);
  color: var(--accent);
}
.card-stats,
.card-kind {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 12px;
  width: 100%;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.5;
}
.card-stats strong {
  margin-left: 3px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
}
.card-faction {
  margin-left: auto;
}
.card-kind {
  justify-content: space-between;
}
.empty-results {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 64px 16px;
  text-align: center;
  color: var(--text-dim);
}
.empty-results h2 {
  margin: 16px 0 8px;
  color: var(--text);
  font-size: 19px;
  font-weight: 600;
}
.empty-results p {
  margin: 0;
  font-size: 14px;
}
.reset-button {
  min-height: 44px;
  margin-top: 20px;
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.reset-button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.pack-note {
  margin: 36px 0 0;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.7;
}
.section-heading h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.section-heading p {
  margin: 8px 0 0;
  color: var(--text-dim);
  font-size: 14px;
}
.turn-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 24px;
  margin: 28px 0 0;
  padding: 0 0 32px;
  border-bottom: 1px solid var(--border);
  list-style: none;
}
.step-number {
  color: var(--accent);
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.turn-steps h3 {
  margin: 8px 0;
  font-size: 17px;
  font-weight: 650;
}
.turn-steps p {
  margin: 0;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1.7;
}
.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 64px;
}
.rule-section {
  min-width: 0;
  padding: 32px 0;
  border-bottom: 1px solid var(--border);
}
.rule-section h2 {
  margin: 0 0 20px;
  font-size: 19px;
  font-weight: 650;
}
.rule-section dl {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}
.rule-section dl > div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  font-size: 14px;
  line-height: 1.7;
}
.rule-section dt {
  font-weight: 600;
}
.rule-section dd {
  margin: 0;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
button:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

@media (max-width: 1200px) {
  .gallery-content {
    padding-right: 28px;
    padding-left: 28px;
  }
  .catalog-layout.with-factions {
    grid-template-columns: 160px minmax(0, 1fr);
    gap: 24px;
  }
  .card-grid {
    gap: 24px 16px;
  }
  .inspect-label {
    padding: 4px;
  }
  .inspect-label > span {
    display: none;
  }
  .card-stats {
    gap: 5px 10px;
  }
  .card-faction {
    margin-left: 0;
  }
  .tab-list {
    gap: 16px;
  }
}
@media (max-width: 1000px) {
  .catalog-layout.with-factions {
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 20px;
  }
  .faction-rail {
    padding-right: 12px;
  }
  .faction-filter {
    padding-right: 12px;
    padding-left: 12px;
  }
  .card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .sort-select {
    width: 180px;
  }
  .tab-list {
    gap: 8px;
  }
  .tab-trigger {
    padding-right: 12px;
    padding-left: 12px;
    font-size: 15px;
  }
  .rules-grid {
    column-gap: 32px;
  }
}
@media (max-width: 800px) {
  .gallery-content {
    padding: 28px 24px 40px;
  }
  .catalog-layout.with-factions {
    display: block;
  }
  .faction-rail {
    margin-bottom: 20px;
    padding: 0 0 12px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .faction-list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
    padding: 2px;
    scrollbar-width: thin;
  }
  .faction-filter {
    flex: 0 0 auto;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
    white-space: nowrap;
  }
  .faction-filter[aria-pressed='true']::before {
    top: auto;
    right: 10px;
    bottom: 0;
    left: 10px;
    width: auto;
    height: 2px;
  }
  .card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px 18px;
  }
  .card-faction {
    margin-left: auto;
  }
  .turn-steps {
    gap: 16px;
  }
}
@media (max-width: 600px) {
  .gallery-content {
    padding: 24px 16px 32px;
  }
  .gallery-intro p {
    margin-top: 8px;
    font-size: 14px;
  }
  .catalog-tabs {
    margin-top: 16px;
  }
  .tab-list {
    gap: 6px;
  }
  .tab-trigger {
    min-height: 48px;
    padding: 10px 10px 12px;
    font-size: 14px;
  }
  .tab-count {
    margin-left: 2px;
    font-size: 11px;
  }
  .tab-content {
    padding-top: 20px;
  }
  .faction-rail {
    margin-bottom: 16px;
  }
  .faction-count {
    display: none;
  }
  .catalog-toolbar {
    flex-wrap: wrap;
    gap: 10px;
  }
  .search-field {
    flex-basis: 100%;
  }
  .sort-select {
    width: 100%;
    min-height: 44px;
  }
  .results-meta {
    min-height: 32px;
    margin-bottom: 8px;
  }
  .card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
  }
  .card-name {
    font-size: 14px;
  }
  .card-id {
    font-size: 10px;
  }
  .card-stats {
    gap: 4px 10px;
    font-size: 10px;
  }
  .card-stats strong {
    font-size: 13px;
  }
  .card-faction {
    margin-left: 0;
  }
  .card-kind {
    gap: 4px 8px;
    font-size: 10px;
  }
  .card-heading {
    gap: 4px;
    padding-top: 8px;
  }
  .pack-note {
    margin-top: 28px;
    font-size: 11px;
  }
  .empty-results {
    padding: 48px 8px;
  }
  .empty-results h2 {
    font-size: 17px;
  }
  .empty-results p {
    font-size: 13px;
  }
  .section-heading h2 {
    font-size: 21px;
  }
  .turn-steps {
    grid-template-columns: 1fr;
    gap: 20px;
    margin-top: 24px;
  }
  .turn-steps li {
    display: grid;
    grid-template-columns: 28px 44px minmax(0, 1fr);
    align-items: baseline;
    gap: 12px;
  }
  .turn-steps h3 {
    margin: 0;
    font-size: 15px;
  }
  .turn-steps p {
    font-size: 13px;
  }
  .rules-grid {
    grid-template-columns: 1fr;
  }
  .rule-section {
    padding: 24px 0;
  }
  .rule-section dl > div {
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 12px;
    font-size: 13px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .card-image {
    transition: none;
  }
}
</style>
