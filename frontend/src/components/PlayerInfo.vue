<template>
  <div
    class="player-info"
    :class="{ 'is-current': isCurrentTurn, 'is-dead': !player.isAlive }"
  >
    <div class="player-header">
      <span class="player-name">{{ displayName }}</span
      ><span v-if="!player.isAlive" class="player-state">已淘汰</span>
    </div>
    <div class="player-hp">
      <span>HP</span
      ><strong
        >{{ player.hp }}<span>/{{ player.maxHp }}</span></strong
      >
    </div>
    <div
      class="hp-bar"
      role="progressbar"
      :aria-label="`${displayName}的体力`"
      :aria-valuenow="player.hp"
      :aria-valuemin="0"
      :aria-valuemax="player.maxHp"
    >
      <div
        class="hp-fill"
        :style="{
          width: `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%`,
        }"
      ></div>
    </div>
    <div class="player-stats">
      <span>手牌 {{ player.hand.length }}</span
      ><span>部署 {{ deployedCount }}/5</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerState } from '../types/game'
const props = defineProps<{ player: PlayerState; isCurrentTurn?: boolean }>()
const displayName = computed(() =>
  props.player.isAi ? props.player.name : '你',
)
const deployedCount = computed(
  () => props.player.deployed.filter((s) => s.character !== null).length,
)
</script>

<style scoped>
.player-info {
  width: 104px;
  min-width: 0;
  flex: 0 0 auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.is-current {
  border-color: var(--accent);
}
.is-dead {
  opacity: 0.6;
}
.player-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.player-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
  overflow-wrap: anywhere;
}
.player-state {
  font-size: 11px;
  color: var(--text-dim);
}
.player-hp {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-dim);
}
.player-hp strong {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.player-hp strong span {
  font-size: 12px;
}
.hp-bar {
  height: 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  overflow: hidden;
}
.hp-fill {
  height: 100%;
  background: var(--accent);
  transition: width 180ms;
}
.player-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-dim);
}
@media (prefers-reduced-motion: reduce) {
  .hp-fill {
    transition: none;
  }
}
</style>
