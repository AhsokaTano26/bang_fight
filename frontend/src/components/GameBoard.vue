<template>
  <div class="game-board">
    <PageHeader title="邦邦武斗传" :show-back="true" @back="$emit('back')" />
    <div v-if="errorMsg" class="board-error" role="alert">
      <span>{{ errorMsg }}</span
      ><button type="button" aria-label="关闭错误提示" @click="errorMsg = null">
        关闭
      </button>
    </div>

    <div v-if="game && game.players" class="battle-layout">
      <aside class="panel-left">
        <details :open="expandedPanels">
          <summary class="panel-title">行动提示</summary>
          <div class="hint-content">
            <template v-if="game.gameOver"
              ><h2 class="hint-text">对局结束</h2>
              <p class="hint-sub">查看本局结果，或再来一局。</p>
              <button
                type="button"
                class="board-button"
                @click="gameOverDialogOpen = true"
              >
                查看结果
              </button></template
            >
            <template v-else-if="!isMyTurn"
              ><h2 class="hint-text">对手回合</h2>
              <p class="hint-sub" role="status">
                AI 正在行动，请稍候。
              </p></template
            >
            <template v-else-if="turnPhase === 'draw'"
              ><h2 class="hint-text">轮到你了</h2>
              <p class="hint-sub">点击「摸牌」抽取本回合手牌。</p></template
            >
            <template v-else-if="actionFlow.active"
              ><h2 class="hint-text">选择与确认</h2>
              <p class="hint-sub">{{ actionFlow.stepLabel }}</p></template
            >
            <template v-else-if="turnPhase === 'action'"
              ><h2 class="hint-text">轮到你了</h2>
              <p class="hint-sub">
                选择手牌，或选择场上角色使用技能。
              </p></template
            >
            <template v-else-if="turnPhase === 'discard'"
              ><h2 class="hint-text">弃牌阶段</h2>
              <p class="hint-sub">
                完成本回合操作后，点击「结束回合」。
              </p></template
            >
            <div class="hint-stats">
              <span
                >部署角色 <strong>{{ deployedCount }}/5</strong></span
              ><span
                >手牌数量 <strong>{{ handCards.length }}</strong></span
              >
            </div>
            <div class="rules-ref">
              <h3>规则速查</h3>
              <p>攻击与格挡需要角色行动点。</p>
              <p>角色状态、HP 和可用 AP 显示在部署区。</p>
              <p>手牌上限 5 张，角色牌不占上限。</p>
              <a href="#gallery">查看卡牌图鉴 →</a>
            </div>
          </div>
        </details>
      </aside>

      <main class="game-main">
        <header class="round-header">
          <span></span>
          <h1>第 {{ game.turnNumber }} 回合</h1>
          <span></span>
        </header>
        <div class="board-scroll" tabindex="0" aria-label="部署区，可左右滚动">
          <div class="battle-field">
            <div
              v-for="ai in aiPlayers"
              :key="ai.id"
              class="combat-row ai-area"
            >
              <PlayerInfo
                :player="ai"
                :isCurrentTurn="currentPlayer?.id === ai.id"
              />
              <DeployZone
                :slots="ai.deployed"
                :animations="activeAnimations"
                :selectable="false"
              />
            </div>
            <div v-if="playerState" class="combat-row player-area">
              <PlayerInfo :player="playerState" :isCurrentTurn="isMyTurn" />
              <DeployZone
                :slots="deployedCharacters"
                :animations="activeAnimations"
                :selectedUid="selectedDeployedUid"
                :disabled="
                  isBusy || !isMyTurn || turnPhase !== 'action' || game.gameOver
                "
                @select="handleDeployedSelect"
              />
            </div>
          </div>
        </div>
        <ActionPanel
          :phase="turnPhase"
          :isMyTurn="isMyTurn && !game.gameOver"
          :selectedCard="selectedCardUid"
          :isCharacterCard="isCharacterCard"
          :selectedDeployedChar="selectedDeployedCharInfo"
          :loading="isBusy"
          @action="handleAction"
        />
        <CardHand
          :handCards="handCards"
          :selectedUid="selectedCardUid"
          :disabled="
            isBusy || !isMyTurn || turnPhase !== 'action' || game.gameOver
          "
          @selectCard="handleCardSelect"
        />
      </main>

      <aside class="panel-right">
        <details :open="expandedPanels">
          <summary class="panel-title">
            对局记录 <span>{{ game.battleLog.length }}</span>
          </summary>
          <BattleLog :logs="game.battleLog || []" />
        </details>
      </aside>
    </div>
    <div v-else class="board-loading" role="status">
      <h1>{{ isBusy ? '正在准备对局…' : '尚未开始对局' }}</h1>
      <p>
        {{ isBusy ? '正在洗牌与安排出场顺序。' : '返回大厅，选择模式后开始。' }}
      </p>
      <button
        v-if="!isBusy"
        type="button"
        class="board-button"
        @click="$emit('back')"
      >
        返回大厅
      </button>
    </div>

    <AppDialog
      v-model="gameOverDialogOpen"
      :title="
        game?.winner && !game.players.find((p) => p.id === game?.winner)?.isAi
          ? '你赢了！'
          : '本局结束'
      "
      :description="`共进行了 ${game?.turnNumber ?? 0} 回合。`"
    >
      <div v-if="game?.gameOver" class="go-stats">
        <div
          v-for="p in game.players"
          :key="p.id"
          class="go-player"
          :class="{ 'go-winner': p.id === game.winner }"
        >
          <div>
            <strong>{{ p.isAi ? p.name : '你' }}</strong
            ><span class="go-detail"
              >HP {{ p.hp }}/{{ p.maxHp }} · 在场
              {{
                p.deployed.filter(
                  (s) => s.character && s.character.state !== 'retired',
                ).length
              }}
              角色</span
            >
          </div>
          <span class="go-result">{{
            p.id === game.winner ? '获胜' : !p.isAlive ? '已淘汰' : '本局结束'
          }}</span>
        </div>
      </div>
      <template #footer
        ><button type="button" class="board-button" @click="$emit('back')">
          返回大厅</button
        ><button
          type="button"
          class="board-button board-button-primary"
          :disabled="isBusy"
          @click="restart"
        >
          {{ isBusy ? '准备中…' : '再来一局' }}
        </button></template
      >
    </AppDialog>
  </div>

  <ActionModal
    :visible="actionFlow.active"
    :step="actionFlow.step"
    :totalSteps="actionFlow.totalSteps"
    :stepType="actionFlow.stepType"
    :stepLabel="actionFlow.stepLabel"
    :cardImage="actionFlow.cardImage"
    :cardName="actionFlow.cardName"
    :cardDesc="actionFlow.cardDesc"
    :cardTypeClass="actionFlow.cardTypeClass"
    :cardTypeName="actionFlow.cardTypeName"
    :cardHp="actionFlow.cardHp"
    :cardAtk="actionFlow.cardAtk"
    :selectedUid="actionFlow.selectedUid"
    :selectedSlot="actionFlow.selectedSlot"
    :excludedUid="
      actionFlow.stepType === 'selectStrategyTarget2'
        ? actionFlow.targetCharUid1
        : null
    "
    :myPlayer="playerState"
    :selectedName="actionFlow.selectedName"
    :selectedImage="actionFlow.selectedImage"
    :selectedMode="actionFlow.selectedMode"
    :confirmSummary="actionFlow.confirmSummary"
    :myDeployed="deployedCharacters"
    :enemyPlayers="aiPlayers"
    :loading="isBusy"
    @select="onModalSelect"
    @selectMode="onModalSelectMode"
    @confirm="onModalConfirm"
    @cancel="onModalCancel"
    @back="onModalBack"
  />
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game'
import {
  getCardById,
  CHARACTER_CARDS,
  ACTION_CARD_DESCRIPTIONS,
  STRATEGY_CARD_DESCRIPTIONS,
} from '../types/cards-data'
import type { ActionCard, StrategyCard } from '../types/card'
import PlayerInfo from './PlayerInfo.vue'
import DeployZone from './DeployZone.vue'
import CardHand from './CardHand.vue'
import ActionPanel from './ActionPanel.vue'
import BattleLog from './BattleLog.vue'
import ActionModal from './ActionModal.vue'
import PageHeader from './PageHeader.vue'
import AppDialog from './ui/AppDialog.vue'

const props = defineProps<{
  startConfig?: { playerCount?: number; aiCount?: number }
}>()

const emit = defineEmits<{
  back: []
}>()

const store = useGameStore()
const boardAbortController = new AbortController()
const boardSignal = boardAbortController.signal
function submitAction(type: string, params: Record<string, any> = {}) {
  if (boardSignal.aborted) return Promise.resolve(null)
  return store.submitAction(type, params, boardSignal)
}
const actionBusy = ref(false)
const isBusy = computed(() => store.loading || actionBusy.value)
const gameOverDialogOpen = ref(false)
const panelMedia = window.matchMedia('(min-width: 1101px)')
const expandedPanels = ref(panelMedia.matches)
const updatePanelLayout = () => {
  expandedPanels.value = panelMedia.matches
}
panelMedia.addEventListener('change', updatePanelLayout)
onBeforeUnmount(() => {
  boardAbortController.abort()
  panelMedia.removeEventListener('change', updatePanelLayout)
  if (errorTimer) clearTimeout(errorTimer)
})

// Auto-start game if config provided
onMounted(async () => {
  if (props.startConfig?.playerCount && props.startConfig?.aiCount) {
    await startGame(props.startConfig.playerCount, props.startConfig.aiCount)
  }
})

// Error toast
const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.error,
  (msg) => {
    if (msg) {
      errorMsg.value = msg
      if (errorTimer) clearTimeout(errorTimer)
      errorTimer = setTimeout(() => {
        errorMsg.value = null
      }, 3000)
    }
  },
)

// Game state
const game = computed(() => store.gameState)
const currentPlayer = computed(() => store.currentPlayer)
const isMyTurn = computed(() => store.isMyTurn)
const turnPhase = computed(() => store.turnPhase)
const playerState = computed(() => store.playerState)
const aiPlayers = computed(() => store.aiPlayers)
const handCards = computed(() => store.handCards)
const deployedCharacters = computed(() => store.deployedCharacters)
const selectedCardUid = computed(() => store.selectedCardUid)
watch(
  () => game.value?.gameOver,
  (value) => {
    gameOverDialogOpen.value = !!value
  },
)

// ---- Deployed character selection (for skill usage) ----
const selectedDeployedUid = ref<string | null>(null)

const selectedDeployedCharInfo = computed(() => {
  if (!selectedDeployedUid.value || !playerState.value) return null
  for (const slot of deployedCharacters.value) {
    if (slot.character?.uid === selectedDeployedUid.value) {
      const charDef = getCharDef(slot.character.cardId)
      return {
        uid: slot.character.uid,
        cardId: slot.character.cardId,
        hasActionPoint: slot.character.hasActionPoint,
        state: slot.character.state,
        skills: charDef?.skills ?? [],
      }
    }
  }
  return null
})

function handleDeployedSelect(uid: string) {
  if (
    boardSignal.aborted ||
    isBusy.value ||
    !isMyTurn.value ||
    turnPhase.value !== 'action' ||
    game.value?.gameOver
  )
    return
  // Toggle selection
  if (selectedDeployedUid.value === uid) {
    selectedDeployedUid.value = null
  } else {
    selectedDeployedUid.value = uid
    // Clear card selection when selecting a deployed character
    store.selectCard(null)
  }
}

// ---- Battle Animation System ----
type AnimationType =
  | 'attack'
  | 'damaged'
  | 'block'
  | 'heal'
  | 'deploy'
  | 'near-death'
interface AnimationEntry {
  type: AnimationType
  value?: number
  duration: number
}
const activeAnimations = reactive<Record<string, AnimationEntry>>({})

const isCharacterCard = computed(() => {
  if (!selectedCardUid.value || !playerState.value) return false
  const card = playerState.value.hand.find(
    (c) => c.uid === selectedCardUid.value,
  )
  if (!card) return false
  return getCardById(card.cardId)?.category === 'character'
})

const deployedCount = computed(
  () => deployedCharacters.value.filter((s) => s.character !== null).length,
)

// ---- Action Flow State Machine ----
type StepType =
  | 'selectAttacker'
  | 'selectTarget'
  | 'selectAlly'
  | 'confirm'
  | 'selectSlot'
  | 'selectReplacement'
  | 'chooseReplenishMode'
  | 'chooseRecoveryMode'
  | 'selectPlayerTarget'
  | 'selectEquipmentTarget'
  | 'selectStrategyTarget'
  | 'selectStrategyPlayer'
  | 'selectStrategyTarget1'
  | 'selectStrategyTarget2'

interface FlowState {
  active: boolean
  step: number
  totalSteps: number
  stepType: StepType
  stepLabel: string
  cardUid: string | null
  cardImage: string
  cardName: string
  cardDesc: string
  cardTypeClass: string
  cardTypeName: string
  cardHp?: number
  cardAtk?: number
  actionType: string
  strategyTargetMode: 'player' | 'twoCharacters' | null
  targetCharUid1: string | null
  targetCharUid2: string | null
  selectedUid: string | null
  selectedAttackerUid: string | null
  selectedTargetPlayerId: string | null
  selectedSlot: number | null
  selectedName: string
  selectedImage: string
  selectedMode: string | null
  confirmSummary: string
  armorPierce: boolean
  skillCharUid?: string | null
}

const actionFlow = reactive<FlowState>({
  active: false,
  step: 0,
  totalSteps: 0,
  stepType: 'confirm',
  stepLabel: '',
  cardUid: null,
  cardImage: '',
  cardName: '',
  cardDesc: '',
  cardTypeClass: '',
  cardTypeName: '',
  cardHp: undefined,
  cardAtk: undefined,
  actionType: '',
  strategyTargetMode: null,
  targetCharUid1: null,
  targetCharUid2: null,
  selectedUid: null,
  selectedAttackerUid: null,
  selectedTargetPlayerId: null,
  selectedSlot: null,
  selectedName: '',
  selectedImage: '',
  selectedMode: null,
  confirmSummary: '',
  armorPierce: false,
  skillCharUid: null,
})

function resetFlow() {
  Object.assign(actionFlow, {
    active: false,
    step: 0,
    totalSteps: 0,
    stepType: 'confirm',
    stepLabel: '',
    cardUid: null,
    cardImage: '',
    cardName: '',
    cardDesc: '',
    cardTypeClass: '',
    cardTypeName: '',
    cardHp: undefined,
    cardAtk: undefined,
    actionType: '',
    strategyTargetMode: null,
    targetCharUid1: null,
    targetCharUid2: null,
    selectedUid: null,
    selectedAttackerUid: null,
    selectedTargetPlayerId: null,
    selectedSlot: null,
    selectedName: '',
    selectedImage: '',
    selectedMode: null,
    confirmSummary: '',
    armorPierce: false,
    skillCharUid: null,
  })
  selectedDeployedUid.value = null
}

// ---- Card type helpers ----
function getCharDef(cardId: string) {
  return CHARACTER_CARDS.find((c) => c.id === cardId)
}

function resolveActionType(
  cardUid: string,
): { actionType: string; cardDef: any } | null {
  if (!playerState.value) return null
  const card = playerState.value.hand.find((c) => c.uid === cardUid)
  if (!card) return null
  const def = getCardById(card.cardId)
  if (!def) return null
  if (def.category === 'character')
    return { actionType: 'deploy', cardDef: def }
  if (def.category === 'strategy') {
    const st = (def as StrategyCard).strategyType
    return {
      actionType: st === 'deployable' ? 'equipStrategy' : 'instantStrategy',
      cardDef: def,
    }
  }
  return { actionType: (def as ActionCard).actionType, cardDef: def }
}

// ---- Open modal ----
function openActionModal(cardUid: string) {
  const resolved = resolveActionType(cardUid)
  if (!resolved) return

  const { cardDef } = resolved
  const isChar = cardDef.category === 'character'
  const isAction = cardDef.category === 'action'

  let totalSteps = 1
  let firstStepType: StepType = 'confirm'
  const strategyTargetMode =
    cardDef.category === 'strategy' && cardDef.id === 'A0004'
      ? 'player'
      : cardDef.category === 'strategy' && cardDef.id === 'C0012'
        ? 'twoCharacters'
        : null

  if (isAction) {
    const at = (cardDef as ActionCard).actionType
    if (at === 'attack' || at === 'armorPierce') {
      totalSteps = 3
      firstStepType = 'selectAttacker'
    } else if (at === 'smallBlock') {
      totalSteps = 2
      firstStepType = 'selectAlly'
    } else if (at === 'recovery') {
      totalSteps = 3 // chooseRecoveryMode → selectAlly → confirm
      firstStepType = 'chooseRecoveryMode'
    } else if (at === 'bigRecovery') {
      totalSteps = 2 // chooseRecoveryMode → confirm
      firstStepType = 'chooseRecoveryMode'
    } else if (at === 'replenish') {
      totalSteps = 2 // chooseReplenishMode → confirm
      firstStepType = 'chooseReplenishMode'
    } else {
      totalSteps = 1
      firstStepType = 'confirm'
    }
  } else if (cardDef.category === 'strategy') {
    const st = (cardDef as StrategyCard).strategyType
    if (st === 'deployable') {
      totalSteps = 2
      firstStepType = 'selectEquipmentTarget'
    } else if (strategyTargetMode === 'player') {
      totalSteps = 2
      firstStepType = 'selectStrategyPlayer'
    } else if (strategyTargetMode === 'twoCharacters') {
      totalSteps = 3
      firstStepType = 'selectStrategyTarget1'
    } else if (cardDef.requiresTarget) {
      totalSteps = 2
      firstStepType = 'selectStrategyTarget'
    } else {
      totalSteps = 1
      firstStepType = 'confirm'
    }
  } else if (isChar) {
    // Character card: select a slot to deploy
    totalSteps = 2
    firstStepType = 'selectSlot'
  }

  const isStrat = cardDef.category === 'strategy'
  const atype = isStrat
    ? (cardDef as StrategyCard).strategyType === 'deployable'
      ? 'equipStrategy'
      : 'instantStrategy'
    : isAction
      ? (cardDef as ActionCard).actionType
      : 'deploy'
  const desc = isChar
    ? cardDef.skills.length
      ? cardDef.skills[0].description
      : ''
    : isStrat
      ? (STRATEGY_CARD_DESCRIPTIONS[cardDef.id] ??
        (cardDef as StrategyCard).description ??
        '')
      : (ACTION_CARD_DESCRIPTIONS[(cardDef as ActionCard).actionType] ?? '')
  const hp = isChar ? (cardDef as any).maxHp : undefined
  const atk = isChar ? (cardDef as any).attack : undefined
  const typeClass = isChar
    ? 'type-character'
    : isStrat
      ? 'type-strategy'
      : 'type-action'
  const typeName = isChar
    ? '角色牌'
    : isStrat
      ? (cardDef as StrategyCard).strategyType === 'deployable'
        ? '道具牌'
        : '即时牌'
      : getActionTypeName(atype)

  Object.assign(actionFlow, {
    active: true,
    step: 1,
    totalSteps,
    stepType: firstStepType,
    stepLabel: getStepLabel(firstStepType),
    cardUid,
    cardImage: cardDef.imageFile,
    cardName: cardDef.name,
    cardDesc: desc,
    cardTypeClass: typeClass,
    cardTypeName: typeName,
    cardHp: hp,
    cardAtk: atk,
    actionType: atype,
    strategyTargetMode,
    targetCharUid1: null,
    targetCharUid2: null,
    selectedUid: null,
    selectedAttackerUid: null,
    selectedTargetPlayerId: null,
    selectedSlot: null,
    selectedName: '',
    selectedImage: '',
    confirmSummary: getConfirmSummary(atype),
    armorPierce: atype === 'armorPierce',
  })
}

function getActionTypeName(type: string): string {
  const names: Record<string, string> = {
    attack: '攻击',
    armorPierce: '破甲攻击',
    bigBlock: '防御',
    smallBlock: '格挡',
    recovery: '回复',
    bigRecovery: '回复大',
    replenish: '补充',
    deploy: '部署',
  }
  return names[type] ?? type
}

function getStepLabel(stepType: StepType): string {
  const labels: Record<StepType, string> = {
    selectAttacker: '选择己方攻击者',
    selectTarget: '选择敌方目标',
    selectAlly: '选择目标角色',
    confirm: '确认使用',
    selectSlot: '选择部署位置',
    selectReplacement: '选择要替换的场上角色',
    chooseReplenishMode: '选择补充方式',
    chooseRecoveryMode: '选择回复目标',
    selectPlayerTarget: '选择攻击目标（玩家）',
    selectEquipmentTarget: '选择装备目标角色',
    selectStrategyTarget: '选择目标',
    selectStrategyPlayer: '选择目标玩家',
    selectStrategyTarget1: '选择第一名角色',
    selectStrategyTarget2: '选择第二名角色，须与第一名不同',
  }
  return labels[stepType]
}

function getConfirmSummary(actionType: string): string {
  const summaries: Record<string, string> = {
    attack: '确认使用攻击牌？',
    armorPierce: '确认使用破甲攻击牌？',
    bigBlock: '将为所有己方角色施加格挡效果',
    smallBlock: '将为选中角色施加格挡效果',
    recovery: '将回复选中角色的体力',
    bigRecovery: '将回复所有己方角色的体力',
    replenish: '将从牌堆抽取 2 张牌',
    deploy: '将部署该角色到选中的位置',
    equipStrategy: '将道具装备到选中的角色',
    instantStrategy: '确认使用即时牌？',
    useSkill: '确认使用技能？',
  }
  return summaries[actionType] ?? '确认执行此操作？'
}

function advanceStep() {
  const { actionType, step, totalSteps, stepType } = actionFlow

  if (stepType === 'selectStrategyTarget1') {
    if (!isAvailableStrategyCharacter(actionFlow.selectedUid)) return
    Object.assign(actionFlow, {
      step: 2,
      stepType: 'selectStrategyTarget2',
      stepLabel: getStepLabel('selectStrategyTarget2'),
      targetCharUid1: actionFlow.selectedUid,
      targetCharUid2: null,
      selectedUid: null,
      selectedTargetPlayerId: null,
      selectedName: '',
      selectedImage: '',
    })
    return
  }
  if (stepType === 'selectStrategyTarget2') {
    if (
      !isAvailableStrategyCharacter(actionFlow.targetCharUid1) ||
      !isAvailableStrategyCharacter(actionFlow.selectedUid) ||
      actionFlow.selectedUid === actionFlow.targetCharUid1
    )
      return
    const first =
      getCharDefFromEnemy(actionFlow.targetCharUid1) ??
      getCharDefFromDeployed(actionFlow.targetCharUid1)
    const second =
      getCharDefFromEnemy(actionFlow.selectedUid) ??
      getCharDefFromDeployed(actionFlow.selectedUid)
    const targetNames = `${first?.name ?? '第一名角色'}、${second?.name ?? '第二名角色'}`
    Object.assign(actionFlow, {
      step: 3,
      stepType: 'confirm',
      stepLabel: getStepLabel('confirm'),
      targetCharUid2: actionFlow.selectedUid,
      selectedName: targetNames,
      selectedImage: '',
      confirmSummary: `使用 ${actionFlow.cardName} → ${targetNames}`,
    })
    return
  }
  if (stepType === 'selectStrategyPlayer') {
    if (
      !game.value?.players.some(
        (player) =>
          player.id === actionFlow.selectedTargetPlayerId && player.isAlive,
      )
    )
      return
    Object.assign(actionFlow, {
      step: 2,
      stepType: 'confirm',
      stepLabel: getStepLabel('confirm'),
      confirmSummary: `使用 ${actionFlow.cardName} → ${actionFlow.selectedName}`,
    })
    return
  }

  // Handle mode selection → advance to next step based on mode
  if (stepType === 'chooseRecoveryMode') {
    const nextStep = step + 1
    if (actionFlow.selectedMode === 'player' || actionType === 'bigRecovery') {
      // Player recovery and group recovery do not need an individual character.
      Object.assign(actionFlow, {
        step: nextStep,
        totalSteps: 2,
        stepType: 'confirm' as StepType,
        stepLabel: getStepLabel('confirm'),
        confirmSummary:
          actionFlow.selectedMode === 'player'
            ? '将回复玩家的体力'
            : '将回复所有己方角色的体力',
      })
    } else {
      // Character mode: go to selectAlly
      Object.assign(actionFlow, {
        step: nextStep,
        totalSteps: 3,
        stepType: 'selectAlly' as StepType,
        stepLabel: getStepLabel('selectAlly'),
      })
    }
    return
  }

  if (stepType === 'chooseReplenishMode') {
    const nextStep = step + 1
    const modeLabel =
      actionFlow.selectedMode === 'recruit'
        ? '从角色池招揽1张角色牌'
        : '从牌堆抽取2张牌'
    Object.assign(actionFlow, {
      step: nextStep,
      stepType: 'confirm' as StepType,
      stepLabel: getStepLabel('confirm'),
      confirmSummary: `将使用补充牌：${modeLabel}`,
    })
    return
  }

  if (step < totalSteps) {
    const nextStep = step + 1
    let nextStepType: StepType = 'confirm'

    // If current step is selectAlly (from recovery character mode), go to confirm
    if (stepType === 'selectAlly') {
      nextStepType = 'confirm'
    } else if (
      stepType === 'selectEquipmentTarget' ||
      stepType === 'selectStrategyTarget'
    ) {
      nextStepType = 'confirm'
    } else if (actionType === 'attack' || actionType === 'armorPierce') {
      nextStepType = nextStep === 2 ? 'selectTarget' : 'confirm'
    } else if (actionType === 'smallBlock') {
      nextStepType = 'confirm'
    } else if (actionType === 'recovery') {
      // Recovery flow handled by chooseRecoveryMode handler above
      nextStepType = 'confirm'
    } else if (actionType === 'bigRecovery') {
      // Big recovery flow handled by chooseRecoveryMode handler above
      nextStepType = 'confirm'
    } else if (actionType === 'replenish') {
      // Replenish flow handled by chooseReplenishMode handler above
      nextStepType = 'confirm'
    } else if (actionType === 'deploy') {
      nextStepType = 'confirm'
    } else if (actionType === 'useSkill') {
      nextStepType = 'confirm'
    }

    // Update selected display for confirm step
    let selectedName = ''
    let selectedImage = ''
    let confirmSummary = ''

    if (nextStepType === 'confirm') {
      if (actionType === 'attack' || actionType === 'armorPierce') {
        const atkChar = getCharDefFromDeployed(actionFlow.selectedAttackerUid)
        selectedName = atkChar?.name ?? ''
        selectedImage = atkChar?.imageFile ?? ''
        const targetName =
          getCharDefFromEnemy(actionFlow.selectedUid)?.name ??
          aiPlayers.value.find(
            (player) => player.id === actionFlow.selectedTargetPlayerId,
          )?.name ??
          '目标'
        confirmSummary = `使用 ${actionFlow.cardName}：${selectedName} 攻击 ${targetName}`
      } else if (actionType === 'smallBlock') {
        const char = getCharDefFromDeployed(actionFlow.selectedUid)
        selectedName = char?.name ?? ''
        selectedImage = char?.imageFile ?? ''
        confirmSummary = `使用格挡保护 ${selectedName}`
      } else if (actionType === 'recovery') {
        const char = getCharDefFromDeployed(actionFlow.selectedUid)
        selectedName = char?.name ?? ''
        selectedImage = char?.imageFile ?? ''
        confirmSummary = `使用回复治疗 ${selectedName}`
      } else if (actionType === 'deploy') {
        const card = playerState.value?.hand.find(
          (c) => c.uid === actionFlow.cardUid,
        )
        if (card) {
          const def = getCharDef(card.cardId)
          selectedName = def?.name ?? ''
          selectedImage = def?.imageFile ?? ''
        }
        confirmSummary = `将 ${selectedName} 部署到位置 ${actionFlow.selectedSlot! + 1}`
      } else if (actionType === 'equipStrategy') {
        const char = getCharDefFromDeployed(actionFlow.selectedUid)
        selectedName = char?.name ?? ''
        selectedImage = char?.imageFile ?? ''
        confirmSummary = `将 ${actionFlow.cardName} 装备到 ${selectedName}`
      } else if (actionType === 'instantStrategy') {
        selectedName = actionFlow.selectedName
        selectedImage = actionFlow.selectedImage
        confirmSummary = selectedName
          ? `使用 ${actionFlow.cardName} → ${selectedName}`
          : `使用 ${actionFlow.cardName}`
      } else if (actionType === 'useSkill') {
        const targetChar = getCharDefFromDeployed(actionFlow.selectedUid)
        selectedName = targetChar?.name ?? ''
        selectedImage = targetChar?.imageFile ?? ''
        confirmSummary = selectedName
          ? `使用 ${actionFlow.cardName} → ${selectedName}`
          : `使用 ${actionFlow.cardName}`
      } else {
        confirmSummary = getConfirmSummary(actionType)
      }
    }

    Object.assign(actionFlow, {
      step: nextStep,
      stepType: nextStepType,
      stepLabel: getStepLabel(nextStepType),
      selectedName,
      selectedImage,
      ...(nextStepType === 'confirm' ? { confirmSummary } : {}),
    })
  }
}

function getCharDefFromDeployed(uid: string | null) {
  if (!uid) return null
  for (const slot of deployedCharacters.value) {
    if (slot.character?.uid === uid) {
      return getCharDef(slot.character.cardId)
    }
  }
  return null
}

function getCharDefFromEnemy(uid: string | null) {
  if (!uid) return null
  for (const enemy of aiPlayers.value) {
    for (const slot of enemy.deployed) {
      if (slot.character?.uid === uid) {
        return getCharDef(slot.character.cardId)
      }
    }
  }
  return null
}

function isAvailableStrategyCharacter(uid: string | null) {
  return (
    !!uid &&
    !!game.value?.players.some(
      (player) =>
        player.isAlive &&
        player.deployed.some(
          (slot) =>
            slot.character?.uid === uid && slot.character.state !== 'retired',
        ),
    )
  )
}

// ---- Modal handlers ----
function onModalSelect(uid: string, playerId?: string) {
  if (boardSignal.aborted || isBusy.value) return
  if (actionFlow.stepType === 'selectStrategyPlayer') {
    const targetPlayer = game.value?.players.find(
      (player) => player.id === uid && player.isAlive,
    )
    if (!targetPlayer) return
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = uid
    actionFlow.selectedName = targetPlayer.isAi ? targetPlayer.name : '你'
    actionFlow.selectedImage = ''
  } else if (
    actionFlow.stepType === 'selectStrategyTarget1' ||
    actionFlow.stepType === 'selectStrategyTarget2'
  ) {
    if (
      !isAvailableStrategyCharacter(uid) ||
      (actionFlow.stepType === 'selectStrategyTarget2' &&
        uid === actionFlow.targetCharUid1)
    )
      return
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = null
    if (actionFlow.stepType === 'selectStrategyTarget1') {
      actionFlow.targetCharUid1 = null
      actionFlow.targetCharUid2 = null
    }
    const target = getCharDefFromEnemy(uid) ?? getCharDefFromDeployed(uid)
    actionFlow.selectedName = target?.name ?? uid
    actionFlow.selectedImage = target?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectAttacker') {
    actionFlow.selectedUid = uid
    actionFlow.selectedAttackerUid = uid
    const char = getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectTarget') {
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = playerId ?? null
    const char = getCharDefFromEnemy(uid)
    actionFlow.selectedName =
      char?.name ??
      aiPlayers.value.find((player) => player.id === uid)?.name ??
      ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectAlly') {
    actionFlow.selectedUid = uid
    const char = getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectSlot') {
    actionFlow.selectedSlot = parseInt(uid, 10)
  } else if (actionFlow.stepType === 'selectReplacement') {
    actionFlow.selectedUid = uid
    const char = getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectPlayerTarget') {
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = uid
    actionFlow.selectedName = playerId ?? uid
  } else if (actionFlow.stepType === 'selectEquipmentTarget') {
    actionFlow.selectedUid = uid
    const char = getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectStrategyTarget') {
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = playerId ?? null
    const char = getCharDefFromEnemy(uid) ?? getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? playerId ?? uid
    actionFlow.selectedImage = char?.imageFile ?? ''
  }
}

function onModalConfirm() {
  if (boardSignal.aborted || isBusy.value) return
  if (
    actionFlow.strategyTargetMode === 'twoCharacters' &&
    actionFlow.stepType === 'confirm' &&
    (!isAvailableStrategyCharacter(actionFlow.targetCharUid1) ||
      !isAvailableStrategyCharacter(actionFlow.targetCharUid2) ||
      actionFlow.targetCharUid1 === actionFlow.targetCharUid2)
  )
    return
  if (
    actionFlow.stepType === 'chooseReplenishMode' ||
    actionFlow.stepType === 'chooseRecoveryMode'
  ) {
    // Mode selected, advance to next step
    advanceStep()
  } else if (actionFlow.step < actionFlow.totalSteps) {
    advanceStep()
  } else {
    executeAction()
  }
}

function onModalSelectMode(mode: string) {
  if (boardSignal.aborted || isBusy.value) return
  actionFlow.selectedMode = mode
}

function onModalCancel() {
  if (boardSignal.aborted) return
  resetFlow()
  store.selectCard(null)
}

function onModalBack() {
  if (boardSignal.aborted || isBusy.value) return
  if (
    actionFlow.strategyTargetMode === 'twoCharacters' &&
    actionFlow.step > 1
  ) {
    const returningToFirst = actionFlow.step === 2
    Object.assign(actionFlow, {
      step: returningToFirst ? 1 : 2,
      stepType: returningToFirst
        ? 'selectStrategyTarget1'
        : 'selectStrategyTarget2',
      stepLabel: getStepLabel(
        returningToFirst ? 'selectStrategyTarget1' : 'selectStrategyTarget2',
      ),
      targetCharUid1: returningToFirst ? null : actionFlow.targetCharUid1,
      targetCharUid2: null,
      selectedUid: null,
      selectedTargetPlayerId: null,
      selectedName: '',
      selectedImage: '',
    })
    return
  }
  if (actionFlow.step > 1) {
    actionFlow.step--
    if (
      actionFlow.actionType === 'attack' ||
      actionFlow.actionType === 'armorPierce'
    ) {
      actionFlow.stepType =
        actionFlow.step === 1 ? 'selectAttacker' : 'selectTarget'
      if (actionFlow.step === 1) {
        actionFlow.selectedUid = actionFlow.selectedAttackerUid
      }
    } else if (actionFlow.actionType === 'smallBlock') {
      actionFlow.stepType = 'selectAlly'
    } else if (actionFlow.actionType === 'replenish') {
      actionFlow.stepType = 'chooseReplenishMode'
    } else if (
      actionFlow.actionType === 'recovery' ||
      actionFlow.actionType === 'bigRecovery'
    ) {
      actionFlow.stepType =
        actionFlow.actionType === 'recovery' &&
        actionFlow.selectedMode === 'character' &&
        actionFlow.step === 2
          ? 'selectAlly'
          : 'chooseRecoveryMode'
    } else if (actionFlow.actionType === 'deploy') {
      actionFlow.stepType = 'selectSlot'
    } else if (actionFlow.actionType === 'equipStrategy') {
      actionFlow.stepType = 'selectEquipmentTarget'
    } else if (actionFlow.actionType === 'instantStrategy') {
      actionFlow.stepType =
        actionFlow.strategyTargetMode === 'player'
          ? 'selectStrategyPlayer'
          : 'selectStrategyTarget'
    } else if (actionFlow.actionType === 'useSkill') {
      actionFlow.stepType = 'selectAlly'
    }
    actionFlow.stepLabel = getStepLabel(actionFlow.stepType)
  }
}

// ---- Execute action ----
async function executeAction() {
  if (boardSignal.aborted || isBusy.value) return
  actionBusy.value = true
  try {
    const {
      actionType,
      cardUid,
      selectedUid,
      selectedTargetPlayerId,
      selectedSlot,
      armorPierce,
    } = actionFlow

    let result: Record<string, any> | null = null
    let animParams: Record<string, any> = {}

    switch (actionType) {
      case 'attack':
      case 'armorPierce': {
        const targetsPlayer =
          !!selectedTargetPlayerId &&
          (!selectedUid || selectedUid === selectedTargetPlayerId)
        const attackParams = {
          attackerCharUid: actionFlow.selectedAttackerUid,
          targetPlayerId: selectedTargetPlayerId,
          ...(targetsPlayer ? {} : { targetCharUid: selectedUid }),
        }
        animParams = {
          attackerCharUid: actionFlow.selectedAttackerUid,
          ...(targetsPlayer ? {} : { targetCharUid: selectedUid }),
        }
        if (cardUid) {
          // Hand cards must go through playCard so the engine consumes the card.
          result = await submitAction('playCard', {
            cardUid,
            params: attackParams,
          })
        } else if (targetsPlayer) {
          result = await submitAction('directAttack', {
            attackerCharUid: actionFlow.selectedAttackerUid,
            targetPlayerId: selectedTargetPlayerId,
          })
        } else {
          result = await submitAction('attack', {
            ...attackParams,
            armorPierce,
          })
        }
        break
      }
      case 'smallBlock':
        animParams = { targetCharUid: selectedUid }
        result = await submitAction('playCard', {
          cardUid,
          params: { targetCharUid: selectedUid },
        })
        break
      case 'recovery':
        if (actionFlow.selectedMode === 'player') {
          result = await submitAction('playCard', {
            cardUid,
            params: { targetType: 'player' },
          })
        } else {
          animParams = { targetCharUid: selectedUid }
          result = await submitAction('playCard', {
            cardUid,
            params: { targetCharUid: selectedUid },
          })
        }
        break
      case 'bigRecovery':
        if (actionFlow.selectedMode === 'player') {
          result = await submitAction('playCard', {
            cardUid,
            params: { targetType: 'player' },
          })
        } else {
          result = await submitAction('playCard', { cardUid })
        }
        break
      case 'bigBlock':
        result = await submitAction('playCard', { cardUid })
        break
      case 'replenish':
        result = await submitAction('playCard', {
          cardUid,
          params: { mode: actionFlow.selectedMode ?? 'draw' },
        })
        break
      case 'deploy':
        animParams = { position: selectedSlot }
        result = await submitAction('deploy', {
          cardUid,
          position: selectedSlot ?? 0,
        })
        break
      case 'replaceCharacter':
        result = await submitAction('replaceCharacter', {
          deployedUid: selectedUid,
          handCardUid: cardUid,
        })
        break
      case 'equipStrategy':
        result = await submitAction('playCard', {
          cardUid,
          params: { targetCharUid: selectedUid },
        })
        break
      case 'instantStrategy':
        result = await submitAction('playCard', {
          cardUid,
          params:
            actionFlow.strategyTargetMode === 'player'
              ? {
                  targetPlayerId: selectedTargetPlayerId,
                }
              : actionFlow.strategyTargetMode === 'twoCharacters'
                ? {
                    targetCharUid1: actionFlow.targetCharUid1,
                    targetCharUid2: actionFlow.targetCharUid2,
                  }
                : {
                    targetCharUid: selectedUid,
                    targetPlayerId: selectedTargetPlayerId,
                  },
        })
        break
      case 'useSkill':
        result = await submitAction('useSkill', {
          charUid: actionFlow.skillCharUid || actionFlow.selectedAttackerUid,
          params: {
            targetCharUid: selectedUid,
          },
        })
        break
    }

    if (boardSignal.aborted) return
    triggerAnimations(actionType, result, animParams)
    resetFlow()
    store.selectCard(null)
  } finally {
    actionBusy.value = false
  }
}

// ---- Animation Trigger ----
function triggerAnimations(
  actionType: string,
  result: Record<string, any> | null,
  params: Record<string, any>,
) {
  if (!result || !result.success) return

  const DUR = 800

  switch (actionType) {
    case 'attack':
    case 'armorPierce': {
      if (params.attackerCharUid) {
        activeAnimations[params.attackerCharUid] = {
          type: 'attack',
          duration: DUR,
        }
        setTimeout(() => {
          delete activeAnimations[params.attackerCharUid]
        }, DUR + 100)
      }
      if (params.targetCharUid) {
        const dmgMatch = result.message?.match(/造成了(\d+)点伤害/)
        const damage = dmgMatch ? parseInt(dmgMatch[1]) : undefined
        if (result.nearDeathTriggered) {
          // Damaged flash, then switch to near-death loop
          activeAnimations[params.targetCharUid] = {
            type: 'damaged',
            value: damage,
            duration: DUR,
          }
          setTimeout(() => {
            activeAnimations[params.targetCharUid] = {
              type: 'near-death',
              duration: DUR,
            }
            // Near-death loop persists until next turn — clear after 3s
            setTimeout(() => {
              delete activeAnimations[params.targetCharUid]
            }, 3000)
          }, DUR)
        } else {
          activeAnimations[params.targetCharUid] = {
            type: 'damaged',
            value: damage,
            duration: DUR,
          }
          setTimeout(() => {
            delete activeAnimations[params.targetCharUid]
          }, DUR + 100)
        }
      }
      break
    }
    case 'smallBlock':
    case 'bigBlock': {
      if (actionType === 'smallBlock' && params.targetCharUid) {
        activeAnimations[params.targetCharUid] = {
          type: 'block',
          duration: DUR,
        }
        setTimeout(() => {
          delete activeAnimations[params.targetCharUid]
        }, DUR + 100)
      } else if (actionType === 'bigBlock') {
        for (const slot of deployedCharacters.value) {
          if (slot.character) {
            activeAnimations[slot.character.uid] = {
              type: 'block',
              duration: DUR,
            }
            const uid = slot.character.uid
            setTimeout(() => {
              delete activeAnimations[uid]
            }, DUR + 100)
          }
        }
      }
      break
    }
    case 'recovery':
    case 'bigRecovery': {
      if (actionType === 'recovery' && params.targetCharUid) {
        const healMatch = result.message?.match(/回复了(\d+)点/)
        const healAmount = healMatch ? parseInt(healMatch[1]) : undefined
        activeAnimations[params.targetCharUid] = {
          type: 'heal',
          value: healAmount,
          duration: DUR,
        }
        setTimeout(() => {
          delete activeAnimations[params.targetCharUid]
        }, DUR + 100)
      } else if (actionType === 'bigRecovery') {
        for (const slot of deployedCharacters.value) {
          if (slot.character) {
            activeAnimations[slot.character.uid] = {
              type: 'heal',
              duration: DUR,
            }
            const uid = slot.character.uid
            setTimeout(() => {
              delete activeAnimations[uid]
            }, DUR + 100)
          }
        }
      }
      break
    }
    case 'deploy': {
      const position = params.position
      const slot = deployedCharacters.value[position]
      if (slot?.character) {
        activeAnimations[slot.character.uid] = { type: 'deploy', duration: DUR }
        const uid = slot.character.uid
        setTimeout(() => {
          delete activeAnimations[uid]
        }, DUR + 100)
      }
      break
    }
  }
}

// ---- UI handlers ----
const gameConfig = ref({ playerCount: 1, aiCount: 1 })

async function startGame(playerCount: number, aiCount: number) {
  if (boardSignal.aborted || actionBusy.value) return
  actionBusy.value = true
  try {
    resetFlow()
    store.selectCard(null)
    gameConfig.value = { playerCount, aiCount }
    await store.createGame(playerCount, aiCount, boardSignal)
    if (boardSignal.aborted) return
    if (store.gameState) await store.startTurn(boardSignal)
  } finally {
    actionBusy.value = false
  }
}

async function restart() {
  if (boardSignal.aborted || isBusy.value) return
  resetFlow()
  store.selectCard(null)
  await startGame(gameConfig.value.playerCount, gameConfig.value.aiCount)
}

function handleCardSelect(uid: string) {
  if (
    boardSignal.aborted ||
    isBusy.value ||
    !isMyTurn.value ||
    turnPhase.value !== 'action' ||
    game.value?.gameOver
  )
    return
  if (actionFlow.active) {
    // If modal is open and clicking same card, close it
    if (actionFlow.cardUid === uid) {
      onModalCancel()
      return
    }
    // Otherwise switch card
    store.selectCard(uid)
    openActionModal(uid)
    return
  }

  store.selectCard(uid)
  if (uid) {
    openActionModal(uid)
  }
}

async function handleAction(type: string, _params: Record<string, any> = {}) {
  if (
    boardSignal.aborted ||
    isBusy.value ||
    !isMyTurn.value ||
    game.value?.gameOver
  )
    return
  actionBusy.value = true
  try {
    switch (type) {
      case 'draw':
        await submitAction('draw')
        break
      case 'playCard': {
        const { cardUid } = _params
        if (cardUid) openActionModal(cardUid)
        break
      }
      case 'deploy': {
        if (store.selectedCardUid) openActionModal(store.selectedCardUid)
        break
      }
      case 'endTurn': {
        const result = await submitAction('endTurn')
        if (boardSignal.aborted || !result?.success) break
        if (store.gameState && !store.gameState.gameOver) {
          await new Promise((r) => setTimeout(r, 300))
          if (boardSignal.aborted) break
          // Keep triggering AI turns until it's a human player's turn (max 10 safety)
          let aiTurns = 0
          while (
            !boardSignal.aborted &&
            store.gameState &&
            !store.gameState.gameOver &&
            store.currentPlayer?.isAi &&
            aiTurns < 10
          ) {
            await store.triggerAiTurn(boardSignal)
            if (boardSignal.aborted) return
            await new Promise((r) => setTimeout(r, 300))
            if (boardSignal.aborted) return
            aiTurns++
          }
          // Start human player's turn
          if (
            !boardSignal.aborted &&
            store.gameState &&
            !store.gameState.gameOver
          ) {
            await store.startTurn(boardSignal)
          }
        }
        break
      }
      case 'useSkill': {
        const { charUid, skillIndex } = _params
        if (!charUid) break

        // Get character info for the skill
        const charInfo = selectedDeployedCharInfo.value
        if (!charInfo) break

        const skill = charInfo.skills[skillIndex ?? 0]
        if (!skill) break

        // Check if skill needs a target
        const needsTarget =
          skill.effect.type === 'stealCard' ||
          skill.effect.type === 'buffAlly' ||
          skill.effect.type === 'sacrificeHealAlly' ||
          skill.effect.type === 'transferDebuff' ||
          skill.effect.type === 'grantSkillTrigger'

        if (needsTarget) {
          // Open modal to select target
          startSkillFlow(charUid, skill)
        } else {
          // Execute directly
          const result = await submitAction('useSkill', {
            charUid,
            params: {},
          })
          if (!boardSignal.aborted && result?.success) {
            selectedDeployedUid.value = null
          }
        }
        break
      }
    }
  } finally {
    actionBusy.value = false
  }
}

// ---- Skill flow ----
function startSkillFlow(
  charUid: string,
  skill: {
    name: string
    description: string
    consumeActionPoint: boolean
    effect: any
  },
) {
  const charInfo = selectedDeployedCharInfo.value
  if (!charInfo) return

  const charDef = getCharDef(charInfo.cardId)

  Object.assign(actionFlow, {
    active: true,
    step: 1,
    totalSteps: 2,
    stepType: 'selectAlly' as StepType,
    stepLabel: '选择技能目标',
    cardUid: null,
    cardImage: charDef?.imageFile ?? '',
    cardName: skill.name,
    cardDesc: skill.description,
    cardTypeClass: 'type-skill',
    cardTypeName: '角色技能',
    cardHp: undefined,
    cardAtk: undefined,
    actionType: 'useSkill',
    strategyTargetMode: null,
    targetCharUid1: null,
    targetCharUid2: null,
    selectedUid: null,
    selectedAttackerUid: charUid,
    selectedTargetPlayerId: null,
    selectedSlot: null,
    selectedName: '',
    selectedImage: '',
    confirmSummary: `使用 ${skill.name}？`,
    armorPierce: false,
    skillCharUid: charUid,
  })
}
</script>

<style scoped>
.game-board {
  min-height: 100svh;
  min-width: 0;
  background: var(--bg-primary);
  color: var(--text);
}
.battle-layout {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr) 220px;
  align-items: start;
  gap: 24px;
  max-width: 1680px;
  margin: 0 auto;
  padding: 24px;
}
.panel-left,
.panel-right {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.panel-title {
  min-height: 44px;
  padding: 0 0 16px;
  color: var(--text);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}
.panel-title span {
  margin-left: 4px;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
}
details[open] > .panel-title {
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.hint-text {
  position: relative;
  margin: 0 0 12px;
  padding-left: 12px;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.4;
}
.hint-text::before {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  content: '';
}
.hint-sub {
  margin: 0;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.8;
}
.hint-stats {
  display: grid;
  gap: 8px;
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-dim);
}
.hint-stats > span {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.hint-stats strong {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.rules-ref {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-dim);
}
.rules-ref h3 {
  margin: 0 0 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
}
.rules-ref p {
  margin: 0 0 8px;
}
.rules-ref a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--accent);
}
.game-main {
  min-width: 0;
}
.round-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 0 0 24px;
}
.round-header h1 {
  margin: 0;
  white-space: nowrap;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
}
.round-header > span {
  height: 1px;
  background: var(--border);
  flex: 1;
}
.board-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  padding: 3px 3px 10px;
}
.battle-field {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 728px;
}
.combat-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.player-area {
  padding-top: 8px;
}
.board-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 1000px;
  margin: 16px auto 0;
  padding: 8px 16px;
  border: 1px solid var(--error, #b33242);
  border-radius: 8px;
  color: var(--error, #b33242);
  background: var(--surface);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.board-error button {
  min-height: 44px;
  flex: 0 0 auto;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.board-loading {
  padding: 80px 24px;
  text-align: center;
}
.board-loading h1 {
  font-size: 24px;
}
.board-loading p {
  color: var(--text-dim);
}
.board-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.board-button-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent, #fff);
}
.board-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.go-stats {
  display: grid;
  gap: 12px;
}
.go-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.go-winner {
  border-color: var(--accent);
}
.go-detail {
  display: block;
  margin-top: 4px;
  color: var(--text-dim);
  font-size: 13px;
}
.go-result {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 13px;
  font-weight: 650;
}
@media (min-width: 1400px) {
  .battle-field {
    --deployed-card-width: 144px;
    --deployed-slot-height: 274px;
  }
}
@media (max-width: 1280px) {
  .battle-layout {
    grid-template-columns: 156px minmax(0, 1fr) 188px;
    gap: 16px;
    padding: 20px;
  }
  .panel-left,
  .panel-right {
    padding: 16px;
  }
}
@media (max-width: 1100px) {
  .battle-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    max-width: 940px;
  }
  .panel-left {
    grid-row: 1;
  }
  .game-main {
    grid-row: 2;
  }
  .panel-right {
    grid-row: 3;
  }
  .panel-left,
  .panel-right {
    padding: 4px 16px;
  }
  .panel-title {
    display: list-item;
    padding: 10px 0;
    font-size: 14px;
  }
  details[open] > .panel-title {
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .hint-content {
    padding-bottom: 16px;
  }
  .hint-stats {
    max-width: 260px;
    margin-top: 16px;
  }
  .rules-ref {
    margin-top: 16px;
  }
  .round-header {
    margin: 4px 0 20px;
  }
}
@media (max-width: 600px) {
  .battle-layout {
    gap: 12px;
    padding: 16px 12px;
  }
  .round-header {
    gap: 16px;
    margin-bottom: 16px;
  }
  .round-header h1 {
    font-size: 21px;
  }
  .battle-field {
    gap: 16px;
  }
  .board-error {
    margin: 12px;
  }
  .go-player {
    padding: 12px;
    gap: 8px;
  }
}
</style>
