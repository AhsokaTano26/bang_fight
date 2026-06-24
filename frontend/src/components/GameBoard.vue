<template>
  <div class="game-board" v-if="game && game.players">
    <!-- Error toast -->
    <Transition name="error-fade">
      <div v-if="errorMsg" class="error-toast" @click="errorMsg = null">{{ errorMsg }}</div>
    </Transition>

    <!-- Left: hints panel -->
    <aside class="panel-left">
      <div class="panel-title">提示</div>
      <div class="hint-content">
        <template v-if="game.gameOver">
          <p class="hint-text">游戏结束！</p>
        </template>
        <template v-else-if="!isMyTurn">
          <p class="hint-text">等待 AI 回合中...</p>
          <p class="hint-sub">AI 正在思考，请稍候</p>
        </template>
        <template v-else-if="turnPhase === 'draw'">
          <p class="hint-text">摸牌阶段</p>
          <p class="hint-sub">点击「摸牌」按钮抽取 2 张牌</p>
        </template>
        <template v-else-if="turnPhase === 'action' && !actionFlow.active">
          <p class="hint-text">行动阶段</p>
          <p class="hint-sub">点击手牌中的卡牌开始操作</p>
          <div class="hint-stats">
            <p>部署角色: {{ deployedCount }}/5</p>
            <p>手牌数量: {{ handCards.length }}</p>
          </div>
        </template>
        <template v-else-if="turnPhase === 'discard'">
          <p class="hint-text">弃牌阶段</p>
          <p class="hint-sub">手牌超过上限，需弃掉多余卡牌</p>
        </template>
        <div class="rules-ref">
          <p class="rules-title">规则速查</p>
          <p class="rules-item">攻击/格挡消耗行动点，每回合最多用 3 个角色的行动点</p>
          <p class="rules-item">格挡即时触发一次后消失，回复回满体力+恢复行动点</p>
          <p class="rules-item">伤害 > 血量 → 退场；伤害 ≤ 血量 → 概率濒死</p>
          <p class="rules-item">手牌上限 5 张（角色牌不占上限）</p>
        </div>
      </div>
    </aside>

    <!-- Center: main game area -->
    <main class="game-main">
      <div class="board-top">
        <div v-for="ai in aiPlayers" :key="ai.id" class="ai-area">
          <PlayerInfo :player="ai" :isCurrentTurn="currentPlayer?.id === ai.id" />
          <DeployZone :slots="ai.deployed" :animations="activeAnimations" />
        </div>
      </div>

      <div class="board-bottom">
        <div class="player-area" v-if="playerState">
          <PlayerInfo :player="playerState" :isCurrentTurn="isMyTurn" />
          <DeployZone :slots="deployedCharacters" :animations="activeAnimations" />
        </div>

        <ActionPanel
          :phase="turnPhase"
          :isMyTurn="isMyTurn"
          :selectedCard="selectedCardUid"
          :isCharacterCard="isCharacterCard"
          @action="handleAction"
        />

        <CardHand
          :handCards="handCards"
          :selectedUid="selectedCardUid"
          @selectCard="handleCardSelect"
        />
      </div>
    </main>

    <!-- Right: battle log -->
    <aside class="panel-right">
      <div class="panel-title">战斗日志</div>
      <BattleLog :logs="game.battleLog || []" />
    </aside>

    <!-- Game over overlay -->
    <div v-if="game.gameOver" class="game-over-overlay">
      <div class="game-over-modal">
        <h2>{{ game.winner && !game.players.find(p => p.id === game.winner)?.isAi ? '你赢了！' : '你输了！' }}</h2>
        <p>回合数: {{ game.turnNumber }}</p>
        <button class="restart-btn" @click="restart">再来一局</button>
      </div>
    </div>
  </div>

  <!-- Lobby (must be adjacent to v-if above) -->
  <div v-else class="lobby">
    <div class="lobby-content">
      <h1 class="lobby-title">邦邦武斗传</h1>
      <p class="lobby-subtitle">BANG BANG FIGHT</p>
      <p class="lobby-ver">内测版 1.0</p>
      <div class="lobby-options">
        <button class="start-btn" @click="startGame(1, 1)">
          <span class="start-label">1 对 1</span>
          <span class="start-desc">挑战 AI 对手</span>
        </button>
        <button class="start-btn" @click="startGame(1, 2)">
          <span class="start-label">1 对 2</span>
          <span class="start-desc">同时对抗两个 AI</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Action Modal (outside v-if/v-else, uses Teleport) -->
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
    :selectedName="actionFlow.selectedName"
    :selectedImage="actionFlow.selectedImage"
    :selectedMode="actionFlow.selectedMode"
    :confirmSummary="actionFlow.confirmSummary"
    :myDeployed="deployedCharacters"
    :enemyPlayers="aiPlayers"
    :loading="store.loading"
    @select="onModalSelect"
    @selectMode="onModalSelectMode"
    @confirm="onModalConfirm"
    @cancel="onModalCancel"
    @back="onModalBack"
  />
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { getCardById, CHARACTER_CARDS, ACTION_CARD_DESCRIPTIONS, STRATEGY_CARD_DESCRIPTIONS } from '../types/cards-data'
import type { ActionCard, StrategyCard } from '../types/card'
import PlayerInfo from './PlayerInfo.vue'
import DeployZone from './DeployZone.vue'
import CardHand from './CardHand.vue'
import ActionPanel from './ActionPanel.vue'
import BattleLog from './BattleLog.vue'
import ActionModal from './ActionModal.vue'

const store = useGameStore()

// Error toast
const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null
watch(() => store.error, (msg) => {
  if (msg) {
    errorMsg.value = msg
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMsg.value = null }, 3000)
  }
})

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

// ---- Battle Animation System ----
type AnimationType = 'attack' | 'damaged' | 'block' | 'heal' | 'deploy' | 'near-death'
interface AnimationEntry {
  type: AnimationType
  value?: number
  duration: number
}
const activeAnimations = reactive<Record<string, AnimationEntry>>({})

const isCharacterCard = computed(() => {
  if (!selectedCardUid.value || !playerState.value) return false
  const card = playerState.value.hand.find(c => c.uid === selectedCardUid.value)
  if (!card) return false
  return ['AG', 'PPP', 'ROS', 'HHW', 'PAS'].some(f => card.cardId.startsWith(f))
})

const deployedCount = computed(() => deployedCharacters.value.filter(s => s.character !== null).length)

// ---- Action Flow State Machine ----
type StepType = 'selectAttacker' | 'selectTarget' | 'selectAlly' | 'confirm' | 'selectSlot'
  | 'selectReplacement' | 'chooseReplenishMode' | 'chooseRecoveryMode' | 'selectPlayerTarget'
  | 'selectEquipmentTarget' | 'selectStrategyTarget'

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
  selectedUid: string | null
  selectedAttackerUid: string | null
  selectedTargetPlayerId: string | null
  selectedSlot: number | null
  selectedName: string
  selectedImage: string
  selectedMode: string | null
  confirmSummary: string
  armorPierce: boolean
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
  selectedUid: null,
  selectedAttackerUid: null,
  selectedTargetPlayerId: null,
  selectedSlot: null,
  selectedName: '',
  selectedImage: '',
  selectedMode: null,
  confirmSummary: '',
  armorPierce: false,
})

function resetFlow() {
  Object.assign(actionFlow, {
    active: false, step: 0, totalSteps: 0, stepType: 'confirm', stepLabel: '',
    cardUid: null, cardImage: '', cardName: '', cardDesc: '', cardTypeClass: '', cardTypeName: '',
    cardHp: undefined, cardAtk: undefined, actionType: '',
    selectedUid: null, selectedAttackerUid: null, selectedTargetPlayerId: null, selectedSlot: null,
    selectedName: '', selectedImage: '', selectedMode: null, confirmSummary: '', armorPierce: false,
  })
}

// ---- Card type helpers ----
function getCharDef(cardId: string) {
  return CHARACTER_CARDS.find(c => c.id === cardId)
}

function resolveActionType(cardUid: string): { actionType: string; cardDef: any } | null {
  if (!playerState.value) return null
  const card = playerState.value.hand.find(c => c.uid === cardUid)
  if (!card) return null
  const def = getCardById(card.cardId)
  if (!def) return null
  if (def.category === 'character') return { actionType: 'deploy', cardDef: def }
  if (def.category === 'strategy') {
    const st = (def as StrategyCard).strategyType
    return { actionType: st === 'deployable' ? 'equipStrategy' : 'instantStrategy', cardDef: def }
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
    } else if (cardDef.requiresTarget) {
      totalSteps = 2
      firstStepType = 'selectStrategyTarget'
    } else {
      totalSteps = 1
      firstStepType = 'confirm'
    }
  } else if (isChar) {
    // Character card: if deployed count > 0, offer replacement; otherwise deploy to empty slot
    const hasDeployed = deployedCharacters.value.some(s => s.character !== null)
    if (hasDeployed) {
      totalSteps = 2
      firstStepType = 'selectSlot' // Will be changed to selectReplacement if slot occupied
    } else {
      totalSteps = 2
      firstStepType = 'selectSlot'
    }
  }

  const isStrat = cardDef.category === 'strategy'
  const atype = isStrat
    ? ((cardDef as StrategyCard).strategyType === 'deployable' ? 'equipStrategy' : 'instantStrategy')
    : (isAction ? (cardDef as ActionCard).actionType : 'deploy')
  const desc = isChar
    ? (cardDef.skills.length ? cardDef.skills[0].description : '')
    : isStrat
      ? (STRATEGY_CARD_DESCRIPTIONS[cardDef.id] ?? (cardDef as StrategyCard).description ?? '')
      : (ACTION_CARD_DESCRIPTIONS[(cardDef as ActionCard).actionType] ?? '')
  const hp = isChar ? (cardDef as any).maxHp : undefined
  const atk = isChar ? (cardDef as any).attack : undefined
  const typeClass = isChar ? 'type-character' : isStrat ? 'type-strategy' : 'type-action'
  const typeName = isChar ? '角色牌' : isStrat ? ((cardDef as StrategyCard).strategyType === 'deployable' ? '道具牌' : '即时牌') : getActionTypeName(atype)

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
    attack: '攻击', armorPierce: '破甲攻击', bigBlock: '防御',
    smallBlock: '格挡', recovery: '回复', bigRecovery: '回复大',
    replenish: '补充', deploy: '部署',
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
  }
  return summaries[actionType] ?? '确认执行此操作？'
}

function advanceStep() {
  const { actionType, step, totalSteps, stepType } = actionFlow

  // Handle mode selection → advance to next step based on mode
  if (stepType === 'chooseRecoveryMode') {
    const nextStep = step + 1
    if (actionFlow.selectedMode === 'player') {
      // Player mode: skip selectAlly, go to confirm
      Object.assign(actionFlow, {
        step: nextStep,
        stepType: 'confirm' as StepType,
        stepLabel: getStepLabel('confirm'),
        confirmSummary: `将回复玩家的体力`,
      })
    } else {
      // Character mode: go to selectAlly
      Object.assign(actionFlow, {
        step: nextStep,
        stepType: 'selectAlly' as StepType,
        stepLabel: getStepLabel('selectAlly'),
      })
    }
    return
  }

  if (stepType === 'chooseReplenishMode') {
    const nextStep = step + 1
    const modeLabel = actionFlow.selectedMode === 'recruit' ? '从角色池招揽1张角色牌' : '从牌堆抽取2张牌'
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
    } else if (stepType === 'selectEquipmentTarget' || stepType === 'selectStrategyTarget') {
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
        confirmSummary = `使用 ${actionFlow.cardName}：${selectedName} 攻击目标`
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
        const card = playerState.value?.hand.find(c => c.uid === actionFlow.cardUid)
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

// ---- Modal handlers ----
function onModalSelect(uid: string, playerId?: string) {
  if (actionFlow.stepType === 'selectAttacker') {
    actionFlow.selectedUid = uid
    actionFlow.selectedAttackerUid = uid
    const char = getCharDefFromDeployed(uid)
    actionFlow.selectedName = char?.name ?? ''
    actionFlow.selectedImage = char?.imageFile ?? ''
  } else if (actionFlow.stepType === 'selectTarget') {
    actionFlow.selectedUid = uid
    actionFlow.selectedTargetPlayerId = playerId ?? null
    const char = getCharDefFromEnemy(uid)
    actionFlow.selectedName = char?.name ?? ''
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
  if (actionFlow.stepType === 'chooseReplenishMode' || actionFlow.stepType === 'chooseRecoveryMode') {
    // Mode selected, advance to next step
    advanceStep()
  } else if (actionFlow.step < actionFlow.totalSteps) {
    advanceStep()
  } else {
    executeAction()
  }
}

function onModalSelectMode(mode: string) {
  actionFlow.selectedMode = mode
}

function onModalCancel() {
  resetFlow()
  store.selectCard(null)
}

function onModalBack() {
  if (actionFlow.step > 1) {
    actionFlow.step--
    if (actionFlow.actionType === 'attack' || actionFlow.actionType === 'armorPierce') {
      actionFlow.stepType = actionFlow.step === 1 ? 'selectAttacker' : 'selectTarget'
      if (actionFlow.step === 1) {
        actionFlow.selectedUid = actionFlow.selectedAttackerUid
      }
    } else if (actionFlow.actionType === 'smallBlock' || actionFlow.actionType === 'recovery') {
      actionFlow.stepType = 'selectAlly'
    } else if (actionFlow.actionType === 'deploy') {
      actionFlow.stepType = 'selectSlot'
    } else if (actionFlow.actionType === 'equipStrategy') {
      actionFlow.stepType = 'selectEquipmentTarget'
    } else if (actionFlow.actionType === 'instantStrategy') {
      actionFlow.stepType = 'selectStrategyTarget'
    }
    actionFlow.stepLabel = getStepLabel(actionFlow.stepType)
  }
}

// ---- Execute action ----
async function executeAction() {
  const { actionType, cardUid, selectedUid, selectedTargetPlayerId, selectedSlot, armorPierce } = actionFlow

  let result: Record<string, any> | null = null
  let animParams: Record<string, any> = {}

  switch (actionType) {
    case 'attack':
    case 'armorPierce': {
      // Check if target is a player (no deployed chars)
      if (selectedTargetPlayerId && !selectedUid) {
        result = await store.submitAction('directAttack', {
          attackerCharUid: actionFlow.selectedAttackerUid,
          targetPlayerId: selectedTargetPlayerId,
        })
      } else {
        animParams = { attackerCharUid: actionFlow.selectedAttackerUid, targetCharUid: selectedUid }
        result = await store.submitAction('attack', {
          cardUid,
          attackerCharUid: actionFlow.selectedAttackerUid,
          targetPlayerId: selectedTargetPlayerId,
          targetCharUid: selectedUid,
          armorPierce,
        })
      }
      break
    }
    case 'smallBlock':
      animParams = { targetCharUid: selectedUid }
      result = await store.submitAction('playCard', { cardUid, params: { targetCharUid: selectedUid } })
      break
    case 'recovery':
      if (actionFlow.selectedMode === 'player') {
        result = await store.submitAction('playCard', { cardUid, params: { targetType: 'player' } })
      } else {
        animParams = { targetCharUid: selectedUid }
        result = await store.submitAction('playCard', { cardUid, params: { targetCharUid: selectedUid } })
      }
      break
    case 'bigRecovery':
      if (actionFlow.selectedMode === 'player') {
        result = await store.submitAction('playCard', { cardUid, params: { targetType: 'player' } })
      } else {
        result = await store.submitAction('playCard', { cardUid })
      }
      break
    case 'bigBlock':
      result = await store.submitAction('playCard', { cardUid })
      break
    case 'replenish':
      result = await store.submitAction('playCard', { cardUid, params: { mode: actionFlow.selectedMode ?? 'draw' } })
      break
    case 'deploy':
      animParams = { position: selectedSlot }
      result = await store.submitAction('deploy', { cardUid, position: selectedSlot ?? 0 })
      break
    case 'replaceCharacter':
      result = await store.submitAction('replaceCharacter', {
        deployedUid: selectedUid,
        handCardUid: cardUid,
      })
      break
    case 'equipStrategy':
      result = await store.submitAction('playCard', {
        cardUid,
        params: { targetCharUid: selectedUid },
      })
      break
    case 'instantStrategy':
      result = await store.submitAction('playCard', {
        cardUid,
        params: {
          targetCharUid: selectedUid,
          targetPlayerId: selectedTargetPlayerId,
        },
      })
      break
  }

  triggerAnimations(actionType, result, animParams)
  resetFlow()
  store.selectCard(null)
}

// ---- Animation Trigger ----
function triggerAnimations(actionType: string, result: Record<string, any> | null, params: Record<string, any>) {
  if (!result || !result.success) return

  const DUR = 800

  switch (actionType) {
    case 'attack':
    case 'armorPierce': {
      if (params.attackerCharUid) {
        activeAnimations[params.attackerCharUid] = { type: 'attack', duration: DUR }
        setTimeout(() => { delete activeAnimations[params.attackerCharUid] }, DUR + 100)
      }
      if (params.targetCharUid) {
        const dmgMatch = result.message?.match(/造成了(\d+)点伤害/)
        const damage = dmgMatch ? parseInt(dmgMatch[1]) : undefined
        if (result.nearDeathTriggered) {
          // Damaged flash, then switch to near-death loop
          activeAnimations[params.targetCharUid] = { type: 'damaged', value: damage, duration: DUR }
          setTimeout(() => {
            activeAnimations[params.targetCharUid] = { type: 'near-death', duration: DUR }
            // Near-death loop persists until next turn — clear after 3s
            setTimeout(() => { delete activeAnimations[params.targetCharUid] }, 3000)
          }, DUR)
        } else {
          activeAnimations[params.targetCharUid] = { type: 'damaged', value: damage, duration: DUR }
          setTimeout(() => { delete activeAnimations[params.targetCharUid] }, DUR + 100)
        }
      }
      break
    }
    case 'smallBlock':
    case 'bigBlock': {
      if (actionType === 'smallBlock' && params.targetCharUid) {
        activeAnimations[params.targetCharUid] = { type: 'block', duration: DUR }
        setTimeout(() => { delete activeAnimations[params.targetCharUid] }, DUR + 100)
      } else if (actionType === 'bigBlock') {
        for (const slot of deployedCharacters.value) {
          if (slot.character) {
            activeAnimations[slot.character.uid] = { type: 'block', duration: DUR }
            const uid = slot.character.uid
            setTimeout(() => { delete activeAnimations[uid] }, DUR + 100)
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
        activeAnimations[params.targetCharUid] = { type: 'heal', value: healAmount, duration: DUR }
        setTimeout(() => { delete activeAnimations[params.targetCharUid] }, DUR + 100)
      } else if (actionType === 'bigRecovery') {
        for (const slot of deployedCharacters.value) {
          if (slot.character) {
            activeAnimations[slot.character.uid] = { type: 'heal', duration: DUR }
            const uid = slot.character.uid
            setTimeout(() => { delete activeAnimations[uid] }, DUR + 100)
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
        setTimeout(() => { delete activeAnimations[uid] }, DUR + 100)
      }
      break
    }
  }
}

// ---- UI handlers ----
async function startGame(playerCount: number, aiCount: number) {
  await store.createGame(playerCount, aiCount)
  await new Promise(r => setTimeout(r, 50))
  if (store.gameState) await store.startTurn()
}

async function restart() {
  await store.createGame(1, 1)

  await new Promise(r => setTimeout(r, 50))
  if (store.gameState) await store.startTurn()
}

function handleCardSelect(uid: string) {
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
  switch (type) {
    case 'draw':
      await store.submitAction('draw')
      break
    case 'endTurn':
      await store.submitAction('endTurn')
      if (store.gameState && !store.gameState.gameOver) {
        await new Promise(r => setTimeout(r, 300))
        // Keep triggering AI turns until it's a human player's turn (max 10 safety)
        let aiTurns = 0
        while (store.gameState && !store.gameState.gameOver && store.currentPlayer?.isAi && aiTurns < 10) {
          await store.triggerAiTurn()
          await new Promise(r => setTimeout(r, 300))
          aiTurns++
        }
        // Start human player's turn
        if (store.gameState && !store.gameState.gameOver) {
          await store.startTurn()
        }
      }
      break
  }
}
</script>

<style scoped>
.game-board {
  display: grid;
  grid-template-columns: 200px 1fr 240px;
  height: 100vh;
  background: linear-gradient(180deg, #0f0c29, #1a1a2e, #16213e);
  background-size: 100% 200%;
  animation: bg-shift 20s ease-in-out infinite alternate;
  overflow: hidden;
}

@keyframes bg-shift {
  0% { background-position: 0% 0%; }
  100% { background-position: 0% 100%; }
}

.panel-left {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #f5a623;
  text-transform: uppercase;
  letter-spacing: 2px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 14px;
}

.hint-text { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.hint-sub { font-size: 14px; color: #aaa; margin: 0 0 12px; }
.hint-stats { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 12px; margin-top: 10px; }
.hint-stats p { font-size: 13px; color: #999; margin: 3px 0; }
.rules-ref { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.rules-title { font-size: 13px; font-weight: 700; color: #f5a623; margin: 0 0 6px; }
.rules-item { font-size: 12px; color: #777; margin: 4px 0; line-height: 1.5; }

.game-main { display: flex; flex-direction: column; overflow: hidden; }
.board-top { flex: 0 0 auto; display: flex; justify-content: center; gap: 24px; padding: 12px 24px; }
.ai-area { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.board-bottom { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 16px; }
.player-area { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 8px; }

.panel-right {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-right :deep(.battle-log) { flex: 1; max-height: none; }

/* Lobby */
.lobby { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f0c29, #1a1a2e, #302b63); }
.lobby-content { text-align: center; }
.lobby-title { font-size: 64px; font-weight: 900; color: #e94560; text-shadow: 0 0 40px rgba(233,69,96,0.5); margin: 0; }
.lobby-subtitle { font-size: 18px; color: #888; margin: 8px 0 4px; letter-spacing: 6px; }
.lobby-ver { font-size: 12px; color: #555; margin: 0 0 48px; }
.lobby-options { display: flex; gap: 24px; justify-content: center; }
.start-btn { display: flex; flex-direction: column; align-items: center; padding: 24px 40px; background: rgba(255,255,255,0.05); border: 2px solid rgba(233,69,96,0.3); border-radius: 16px; cursor: pointer; transition: all 0.3s; color: #fff; }
.start-btn:hover { border-color: #e94560; background: rgba(233,69,96,0.1); transform: translateY(-4px); box-shadow: 0 8px 30px rgba(233,69,96,0.3); }
.start-label { font-size: 24px; font-weight: 700; }
.start-desc { font-size: 12px; color: #999; margin-top: 4px; }

/* Game over */
.game-over-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.game-over-modal { background: #1a1a2e; border: 2px solid #e94560; border-radius: 16px; padding: 48px; text-align: center; }
.game-over-modal h2 { font-size: 36px; margin: 0 0 16px; color: #f5a623; }
.game-over-modal p { color: #999; margin-bottom: 24px; }
.restart-btn { padding: 12px 32px; background: #e94560; border: none; border-radius: 8px; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
.restart-btn:hover { background: #d63a53; }

/* Error toast */
.error-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(233,69,96,0.95); color: #fff; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 9999; cursor: pointer; box-shadow: 0 4px 20px rgba(233,69,96,0.4); }
.error-fade-enter-active, .error-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.error-fade-enter-from, .error-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
