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
          <p class="rules-item">攻击消耗行动点，每回合最多用 3 个角色的行动点</p>
          <p class="rules-item">格挡消耗行动点，回复大不消耗</p>
          <p class="rules-item">伤害 > 血量 → 退场；伤害 ≤ 血量 → 概率濒死</p>
        </div>
      </div>
    </aside>

    <!-- Center: main game area -->
    <main class="game-main">
      <div class="board-top">
        <div v-for="ai in aiPlayers" :key="ai.id" class="ai-area">
          <PlayerInfo :player="ai" :isCurrentTurn="currentPlayer?.id === ai.id" />
          <DeployZone :slots="ai.deployed" />
        </div>
      </div>

      <div class="board-bottom">
        <div class="player-area" v-if="playerState">
          <PlayerInfo :player="playerState" :isCurrentTurn="isMyTurn" />
          <DeployZone :slots="deployedCharacters" />
        </div>

        <ActionPanel
          :phase="turnPhase"
          :isMyTurn="isMyTurn"
          :selectedCard="selectedCardUid"
          :isCharacterCard="isCharacterCard"
          :canPlayCard="selectedCardUid !== null && !actionFlow.active"
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

  <!-- Action Modal -->
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
    :confirmSummary="actionFlow.confirmSummary"
    :myDeployed="deployedCharacters"
    :enemyPlayers="aiPlayers"
    :loading="store.loading"
    @select="onModalSelect"
    @confirm="onModalConfirm"
    @cancel="onModalCancel"
    @back="onModalBack"
  />

  <!-- Lobby -->
  <div v-else class="lobby">
    <div class="lobby-content">
      <h1 class="lobby-title">邦邦武斗传</h1>
      <p class="lobby-subtitle">BANG BANG FIGHT</p>
      <p class="lobby-ver">内测版 1.0</p>
      <div class="lobby-options">
        <button class="start-btn" @click="startGame(2, 1)">
          <span class="start-label">1 对 1</span>
          <span class="start-desc">挑战 AI 对手</span>
        </button>
        <button class="start-btn" @click="startGame(3, 2)">
          <span class="start-label">1 对 2</span>
          <span class="start-desc">同时对抗两个 AI</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { getCardById, CHARACTER_CARDS, ACTION_CARD_DESCRIPTIONS } from '../types/cards-data'
import type { ActionCard } from '../types/card'
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

const isCharacterCard = computed(() => {
  if (!selectedCardUid.value || !playerState.value) return false
  const card = playerState.value.hand.find(c => c.uid === selectedCardUid.value)
  if (!card) return false
  return ['AG', 'PPP', 'ROS', 'HHW', 'PAS'].some(f => card.cardId.startsWith(f))
})

const deployedCount = computed(() => deployedCharacters.value.filter(s => s.character !== null).length)

// ---- Action Flow State Machine ----
type StepType = 'selectAttacker' | 'selectTarget' | 'selectAlly' | 'confirm' | 'selectSlot'

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
  selectedTargetPlayerId: string | null
  selectedSlot: number | null
  selectedName: string
  selectedImage: string
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
  selectedTargetPlayerId: null,
  selectedSlot: null,
  selectedName: '',
  selectedImage: '',
  confirmSummary: '',
  armorPierce: false,
})

function resetFlow() {
  Object.assign(actionFlow, {
    active: false, step: 0, totalSteps: 0, stepType: 'confirm', stepLabel: '',
    cardUid: null, cardImage: '', cardName: '', cardDesc: '', cardTypeClass: '', cardTypeName: '',
    cardHp: undefined, cardAtk: undefined, actionType: '',
    selectedUid: null, selectedTargetPlayerId: null, selectedSlot: null,
    selectedName: '', selectedImage: '', confirmSummary: '', armorPierce: false,
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
  return { actionType: def.category === 'character' ? 'deploy' : (def as ActionCard).actionType, cardDef: def }
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
    } else if (at === 'smallBlock' || at === 'recovery') {
      totalSteps = 2
      firstStepType = 'selectAlly'
    } else {
      totalSteps = 1
      firstStepType = 'confirm'
    }
  } else if (isChar) {
    totalSteps = 2
    firstStepType = 'selectSlot'
  }

  const atype = isAction ? (cardDef as ActionCard).actionType : 'deploy'
  const desc = isChar
    ? (cardDef.skills.length ? cardDef.skills[0].description : '')
    : (ACTION_CARD_DESCRIPTIONS[(cardDef as ActionCard).actionType] ?? '')
  const hp = isChar ? (cardDef as any).maxHp : undefined
  const atk = isChar ? (cardDef as any).attack : undefined
  const typeClass = isChar ? 'type-character' : 'type-action'
  const typeName = isChar ? '角色牌' : getActionTypeName(atype)

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
  }
  return summaries[actionType] ?? '确认执行此操作？'
}

function advanceStep() {
  const { actionType, step, totalSteps } = actionFlow

  if (step < totalSteps) {
    const nextStep = step + 1
    let nextStepType: StepType = 'confirm'

    if (actionType === 'attack' || actionType === 'armorPierce') {
      nextStepType = nextStep === 2 ? 'selectTarget' : 'confirm'
    } else if (actionType === 'smallBlock' || actionType === 'recovery') {
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
        const atkChar = getCharDefFromDeployed(actionFlow.selectedUid)
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
  }
}

function onModalConfirm() {
  if (actionFlow.step < actionFlow.totalSteps) {
    advanceStep()
  } else {
    executeAction()
  }
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
    } else if (actionFlow.actionType === 'smallBlock' || actionFlow.actionType === 'recovery') {
      actionFlow.stepType = 'selectAlly'
    } else if (actionFlow.actionType === 'deploy') {
      actionFlow.stepType = 'selectSlot'
    }
    actionFlow.stepLabel = getStepLabel(actionFlow.stepType)
  }
}

// ---- Execute action ----
async function executeAction() {
  const { actionType, cardUid, selectedUid, selectedTargetPlayerId, selectedSlot, armorPierce } = actionFlow

  switch (actionType) {
    case 'attack':
    case 'armorPierce':
      await store.submitAction('attack', {
        cardUid,
        attackerCharUid: selectedUid,
        targetPlayerId: selectedTargetPlayerId,
        targetCharUid: actionFlow.selectedUid,
        armorPierce,
      })
      break
    case 'smallBlock':
      await store.submitAction('playCard', { cardUid, params: { targetCharUid: selectedUid } })
      break
    case 'recovery':
      await store.submitAction('playCard', { cardUid, params: { targetCharUid: selectedUid } })
      break
    case 'bigBlock':
    case 'bigRecovery':
    case 'replenish':
      await store.submitAction('playCard', { cardUid })
      break
    case 'deploy':
      await store.submitAction('deploy', { cardUid, position: selectedSlot ?? 0 })
      break
  }

  resetFlow()
  store.selectCard(null)
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
        await store.triggerAiTurn()
        if (store.gameState && !store.gameState.gameOver) {
          await new Promise(r => setTimeout(r, 300))
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
  overflow: hidden;
}

.panel-left {
  background: rgba(0, 0, 0, 0.3);
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
