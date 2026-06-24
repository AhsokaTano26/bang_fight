<template>
  <div class="game-board" v-if="game && game.players">
    <!-- Error toast -->
    <Transition name="error-fade">
      <div v-if="errorMsg" class="error-toast" @click="errorMsg = null">
        {{ errorMsg }}
      </div>
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
        <template v-else-if="turnPhase === 'action'">
          <p class="hint-text">行动阶段</p>
          <p class="hint-sub" v-if="!selectedCardUid">选择手牌中的一张卡牌使用</p>
          <p class="hint-sub" v-else-if="isAttackCard">选择敌方角色作为攻击目标</p>
          <p class="hint-sub" v-else-if="isCharacterCard">选择空位部署角色</p>
          <p class="hint-sub" v-else>点击「使用卡牌」打出选中的牌</p>
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
      <!-- Top: AI players -->
      <div class="board-top">
        <div v-for="ai in aiPlayers" :key="ai.id" class="ai-area">
          <PlayerInfo :player="ai" :isCurrentTurn="currentPlayer?.id === ai.id" />
          <DeployZone
            :slots="ai.deployed"
            :targetable="canTarget"
            :selectedUid="selectedTarget"
            @select="(uid) => handleTargetSelect(ai.id, uid)"
          />
        </div>
      </div>

      <!-- Bottom: Player area -->
      <div class="board-bottom">
        <div class="player-area" v-if="playerState">
          <PlayerInfo :player="playerState" :isCurrentTurn="isMyTurn" />
          <DeployZone
            :slots="deployedCharacters"
            :selectedUid="selectedCardUid"
            @select="handleDeploySelect"
            @emptySlot="handleEmptySlot"
          />
        </div>

        <!-- Action panel -->
        <ActionPanel
          :phase="turnPhase"
          :isMyTurn="isMyTurn"
          :selectedCard="selectedCardUid"
          :isCharacterCard="isCharacterCard"
          :canPlayCard="selectedCardUid !== null"
          @action="handleAction"
        />

        <!-- Card hand -->
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
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import PlayerInfo from './PlayerInfo.vue'
import DeployZone from './DeployZone.vue'
import CardHand from './CardHand.vue'
import ActionPanel from './ActionPanel.vue'
import BattleLog from './BattleLog.vue'

const store = useGameStore()

const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null

watch(() => store.error, (msg) => {
  if (msg) {
    errorMsg.value = msg
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMsg.value = null }, 3000)
  }
})

const game = computed(() => store.gameState)
const currentPlayer = computed(() => store.currentPlayer)
const isMyTurn = computed(() => store.isMyTurn)
const turnPhase = computed(() => store.turnPhase)
const playerState = computed(() => store.playerState)
const aiPlayers = computed(() => store.aiPlayers)
const handCards = computed(() => store.handCards)
const deployedCharacters = computed(() => store.deployedCharacters)
const selectedCardUid = computed(() => store.selectedCardUid)
const selectedTarget = computed(() => store.selectedTarget)
const selectedAttackerUid = ref<string | null>(null)

const canTarget = computed(() => {
  if (!isMyTurn.value || turnPhase.value !== 'action') return false
  return isAttackCard.value && selectedAttackerUid.value !== null
})

const isAttackCard = computed(() => {
  if (!selectedCardUid.value) return false
  return selectedCardUid.value.startsWith('ATK') || selectedCardUid.value.startsWith('ARMOR')
})

const isCharacterCard = computed(() => {
  if (!selectedCardUid.value || !playerState.value) return false
  const card = playerState.value.hand.find(c => c.uid === selectedCardUid.value)
  if (!card) return false
  return ['AG', 'PPP', 'ROS', 'HHW', 'PAS'].some(f => card.cardId.startsWith(f))
})

const deployedCount = computed(() => {
  return deployedCharacters.value.filter(s => s.character !== null).length
})

async function startGame(playerCount: number, aiCount: number) {
  await store.createGame(playerCount, aiCount)
  await new Promise(r => setTimeout(r, 50))
  if (store.gameState) {
    await store.startTurn()
  }
}

async function restart() {
  await store.createGame(1, 1)
  await new Promise(r => setTimeout(r, 50))
  if (store.gameState) {
    await store.startTurn()
  }
}

function handleCardSelect(uid: string) {
  store.selectCard(store.selectedCardUid === uid ? null : uid)
  selectedAttackerUid.value = null
}

function handleDeploySelect(uid: string) {
  // If it's an attack card and we haven't selected attacker yet, select attacker
  if (isAttackCard.value && !selectedAttackerUid.value) {
    // Check if selected character belongs to current player
    const isMyCharacter = deployedCharacters.value.some(s => s.character?.uid === uid)
    if (isMyCharacter) {
      selectedAttackerUid.value = uid
      return
    }
  }
  // Otherwise select as target
  store.selectTarget(uid)
}

function handleEmptySlot(position: number) {
  // If a character card is selected, deploy to this empty slot
  if (selectedCardUid.value && isCharacterCard.value) {
    handleAction('deploy', { position })
  }
}

function handleTargetSelect(playerId: string, charUid: string) {
  if (!isAttackCard.value || !selectedAttackerUid.value) return

  // Execute attack
  handleAction('attack', {
    attackerCharUid: selectedAttackerUid.value,
    targetPlayerId: playerId,
    targetCharUid: charUid,
    armorPierce: selectedCardUid.value?.startsWith('ARMOR') ?? false,
  })
}

async function handleAction(type: string, params: Record<string, any> = {}) {
  switch (type) {
    case 'draw':
      await store.submitAction('draw')
      break
    case 'playCard':
      await store.submitAction('playCard', { cardUid: store.selectedCardUid, ...params })
      store.selectCard(null)
      break
    case 'deploy':
      await store.submitAction('deploy', { cardUid: store.selectedCardUid, position: params.position ?? 0 })
      store.selectCard(null)
      break
    case 'attack':
      await store.submitAction('attack', {
        cardUid: store.selectedCardUid,
        attackerCharUid: selectedAttackerUid.value,
        targetPlayerId: params.targetPlayerId,
        targetCharUid: params.targetCharUid,
        armorPierce: params.armorPierce ?? false,
      })
      store.selectCard(null)
      selectedAttackerUid.value = null
      break
    case 'endTurn':
      await store.submitAction('endTurn')
      // Auto-trigger AI turn after player ends
      if (store.gameState && !store.gameState.gameOver) {
        await new Promise(r => setTimeout(r, 300))
        await store.triggerAiTurn()
        // After AI turn, auto-start next player turn
        if (store.gameState && !store.gameState.gameOver) {
          await new Promise(r => setTimeout(r, 300))
          await store.startTurn()
        }
      }
      break
    case 'aiTurn':
      await store.triggerAiTurn()
      if (store.gameState && !store.gameState.gameOver) {
        await store.startTurn()
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

/* Left panel */
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

.hint-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px;
}

.hint-sub {
  font-size: 14px;
  color: #aaa;
  margin: 0 0 12px;
}

.hint-stats {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 10px;
}

.hint-stats p {
  font-size: 13px;
  color: #999;
  margin: 3px 0;
}

.rules-ref {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.rules-title {
  font-size: 13px;
  font-weight: 700;
  color: #f5a623;
  margin: 0 0 6px;
}

.rules-item {
  font-size: 12px;
  color: #777;
  margin: 4px 0;
  line-height: 1.5;
}

/* Center game area */
.game-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.board-top {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px 24px;
}

.ai-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.board-bottom {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 16px;
}

.player-area {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 8px;
}

/* Right panel */
.panel-right {
  background: rgba(0, 0, 0, 0.3);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-right :deep(.battle-log) {
  flex: 1;
  max-height: none;
}

/* Lobby */
.lobby {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29, #1a1a2e, #302b63);
}

.lobby-content {
  text-align: center;
}

.lobby-title {
  font-size: 64px;
  font-weight: 900;
  color: #e94560;
  text-shadow: 0 0 40px rgba(233, 69, 96, 0.5);
  margin: 0;
}

.lobby-subtitle {
  font-size: 18px;
  color: #888;
  margin: 8px 0 4px;
  letter-spacing: 6px;
}

.lobby-ver {
  font-size: 12px;
  color: #555;
  margin: 0 0 48px;
}

.lobby-options {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.start-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(233, 69, 96, 0.3);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  color: #fff;
}

.start-btn:hover {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(233, 69, 96, 0.3);
}

.start-label {
  font-size: 24px;
  font-weight: 700;
}

.start-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* Game over */
.game-over-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.game-over-modal {
  background: #1a1a2e;
  border: 2px solid #e94560;
  border-radius: 16px;
  padding: 48px;
  text-align: center;
}

.game-over-modal h2 {
  font-size: 36px;
  margin: 0 0 16px;
  color: #f5a623;
}

.game-over-modal p {
  color: #999;
  margin-bottom: 24px;
}

.restart-btn {
  padding: 12px 32px;
  background: #e94560;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.restart-btn:hover {
  background: #d63a53;
}

/* Error toast */
.error-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(233, 69, 96, 0.95);
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  z-index: 9999;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(233, 69, 96, 0.4);
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>
