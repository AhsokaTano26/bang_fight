<template>
  <div class="action-panel">
    <div class="phase-indicator">
      <span class="phase-label">阶段</span>
      <span class="phase-name">{{ phaseName }}</span>
    </div>

    <div class="action-buttons">
      <button
        v-if="canDraw"
        class="action-btn btn-draw"
        @click="$emit('action', 'draw')"
      >
        摸牌
      </button>

      <button
        v-if="canPlayCard && selectedCard"
        class="action-btn btn-play"
        @click="$emit('action', 'playCard', { cardUid: selectedCard })"
      >
        使用卡牌
      </button>

      <button
        v-if="canDeploy && selectedCard"
        class="action-btn btn-deploy"
        @click="$emit('action', 'deploy')"
      >
        部署角色
      </button>

      <button
        v-if="canEndTurn"
        class="action-btn btn-end"
        @click="$emit('action', 'endTurn')"
      >
        结束回合
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TurnPhase } from '../types/game'

const props = defineProps<{
  phase: TurnPhase
  isMyTurn: boolean
  selectedCard?: string | null
  hasActionPoints?: boolean
  canPlayCard?: boolean
  isCharacterCard?: boolean
}>()

defineEmits<{
  action: [type: string, params?: Record<string, any>]
}>()

const phaseName = computed(() => {
  const names: Record<string, string> = {
    judgment: '判定阶段',
    draw: '摸牌阶段',
    action: '行动阶段',
    discard: '弃牌阶段',
    ended: '回合结束',
  }
  return names[props.phase] ?? props.phase
})

const canDraw = computed(() => props.isMyTurn && props.phase === 'draw')
const canPlayCard = computed(() => props.isMyTurn && props.phase === 'action' && props.selectedCard && !props.isCharacterCard)
const canDeploy = computed(() => props.isMyTurn && props.phase === 'action' && props.selectedCard && props.isCharacterCard)
const canEndTurn = computed(() => props.isMyTurn && (props.phase === 'action' || props.phase === 'discard'))
</script>

<style scoped>
.action-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.phase-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.phase-label {
  font-size: 13px;
  color: #999;
}

.phase-name {
  font-size: 16px;
  font-weight: 700;
  color: #f5a623;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  padding: 8px 22px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #fff;
}

.btn-draw { background: #4ade80; }
.btn-draw:hover { background: #22c55e; }

.btn-play { background: #60a5fa; }
.btn-play:hover { background: #3b82f6; }

.btn-deploy { background: #a78bfa; }
.btn-deploy:hover { background: #8b5cf6; }

.btn-end { background: #6b7280; }
.btn-end:hover { background: #4b5563; }
</style>
