<template>
  <div class="player-info" :class="{ 'is-current': isCurrentTurn, 'is-dead': !player.isAlive }">
    <div class="player-header">
      <span class="player-name">{{ player.name }}</span>
      <span v-if="player.isAi" class="ai-badge">AI</span>
    </div>
    <div class="player-hp">
      <span class="hp-label">体力值</span>
      <div class="hp-bar">
        <div class="hp-fill" :style="{ width: `${(player.hp / player.maxHp) * 100}%` }"></div>
      </div>
      <span class="hp-value">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>
    <div class="player-stats">
      <span class="stat">手牌 {{ player.hand.length }}</span>
      <span class="stat">部署 {{ deployedCount }}/5</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerState } from '../types/game'

const props = defineProps<{
  player: PlayerState
  isCurrentTurn?: boolean
}>()

const deployedCount = computed(() =>
  props.player.deployed.filter(s => s.character !== null).length
)
</script>

<style scoped>
.player-info {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 160px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.is-current {
  border-color: #f5a623;
  box-shadow: 0 0 10px rgba(245, 166, 35, 0.3);
}

.is-dead {
  opacity: 0.4;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.player-name {
  font-weight: 700;
  font-size: 16px;
}

.ai-badge {
  background: #e94560;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.player-hp {
  margin-bottom: 8px;
}

.hp-label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 3px;
}

.hp-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 3px;
}

.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b81, #e94560);
  transition: width 0.3s;
  border-radius: 4px;
}

.hp-value {
  font-size: 13px;
  color: #ff6b81;
  font-weight: bold;
}

.player-stats {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #888;
}
</style>
