<template>
  <div class="action-panel" :aria-busy="loading">
    <ol class="phase-indicator" aria-label="回合阶段">
      <li
        v-for="stage in stages"
        :key="stage.id"
        :class="{ 'phase-current': phase === stage.id }"
        :aria-current="phase === stage.id ? 'step' : undefined"
      >
        <span class="phase-dot" aria-hidden="true"></span>{{ stage.label }}
      </li>
    </ol>
    <span v-if="phase === 'ended'" class="ended-label">回合结束</span>
    <div class="action-buttons">
      <button
        v-if="canDraw"
        type="button"
        class="action-btn btn-primary"
        :disabled="loading"
        @click="$emit('action', 'draw')"
      >
        {{ loading ? '摸牌中…' : '摸牌' }}
      </button>
      <button
        v-if="canPlayCard && selectedCard"
        type="button"
        class="action-btn btn-primary"
        :disabled="loading"
        @click="$emit('action', 'playCard', { cardUid: selectedCard })"
      >
        使用卡牌
      </button>
      <button
        v-if="canDeploy && selectedCard"
        type="button"
        class="action-btn btn-primary"
        :disabled="loading"
        @click="$emit('action', 'deploy')"
      >
        部署角色
      </button>
      <template v-if="canUseSkill && selectedDeployedChar">
        <button
          v-for="(skill, i) in selectedDeployedChar.skills"
          :key="i"
          type="button"
          class="action-btn btn-skill"
          :disabled="
            loading ||
            (skill.consumeActionPoint && !selectedDeployedChar.hasActionPoint)
          "
          :title="skill.description"
          @click="
            $emit('action', 'useSkill', {
              charUid: selectedDeployedChar.uid,
              skillIndex: i,
            })
          "
        >
          {{ skill.name }}
        </button>
      </template>
      <button
        v-if="canEndTurn"
        type="button"
        class="action-btn btn-primary"
        :disabled="loading"
        @click="$emit('action', 'endTurn')"
      >
        {{ loading ? '处理中…' : '结束回合' }}
      </button>
    </div>
    <p v-if="!isMyTurn" class="waiting-label" role="status">等待对手行动…</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TurnPhase } from '../types/game'
interface DeployedCharInfo {
  uid: string
  cardId: string
  hasActionPoint: boolean
  state: string
  skills: { name: string; description: string; consumeActionPoint: boolean }[]
}
const props = defineProps<{
  phase: TurnPhase
  isMyTurn: boolean
  selectedCard?: string | null
  hasActionPoints?: boolean
  isCharacterCard?: boolean
  selectedDeployedChar?: DeployedCharInfo | null
  loading?: boolean
}>()
defineEmits<{ action: [type: string, params?: Record<string, any>] }>()
const stages = [
  { id: 'judgment', label: '判定' },
  { id: 'draw', label: '摸牌' },
  { id: 'action', label: '行动' },
  { id: 'discard', label: '弃牌' },
]
const canDraw = computed(() => props.isMyTurn && props.phase === 'draw')
const canPlayCard = computed(
  () =>
    props.isMyTurn &&
    props.phase === 'action' &&
    props.selectedCard &&
    !props.isCharacterCard,
)
const canDeploy = computed(
  () =>
    props.isMyTurn &&
    props.phase === 'action' &&
    props.selectedCard &&
    props.isCharacterCard,
)
const canUseSkill = computed(
  () => props.isMyTurn && props.phase === 'action' && !props.selectedCard,
)
const canEndTurn = computed(
  () =>
    props.isMyTurn && (props.phase === 'action' || props.phase === 'discard'),
)
</script>

<style scoped>
.action-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 20px 0;
}
.phase-indicator {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-dim);
  font-size: 13px;
}
.phase-indicator li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.phase-dot {
  display: block;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border);
  border-radius: 50%;
}
.phase-current {
  color: var(--accent);
  font-weight: 650;
}
.phase-current .phase-dot {
  border-color: var(--accent);
  background: var(--accent);
}
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.action-btn {
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}
.btn-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent, #fff);
}
.action-btn:hover:not(:disabled) {
  filter: brightness(0.96);
}
.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ended-label,
.waiting-label {
  margin: 0;
  color: var(--text-dim);
  font-size: 13px;
}
@media (max-width: 600px) {
  .action-panel {
    gap: 12px;
    padding: 16px 0;
  }
  .phase-indicator {
    gap: 12px;
    width: 100%;
  }
  .action-btn {
    padding: 10px 16px;
  }
}
</style>
