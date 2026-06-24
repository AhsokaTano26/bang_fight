<template>
  <div class="battle-log">
    <div class="log-entries" ref="logRef">
      <div
        v-for="(entry, i) in logs"
        :key="i"
        class="log-entry"
      >
        <span class="log-turn">T{{ entry.turn }}</span>
        <span class="log-action">{{ entry.action }}</span>
        <span v-if="entry.details" class="log-details">{{ entry.details }}</span>
      </div>
      <div v-if="!logs.length" class="log-empty">等待游戏开始...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { BattleLogEntry } from '../types/game'

const props = defineProps<{
  logs: BattleLogEntry[]
}>()

const logRef = ref<HTMLElement>()

watch(() => props.logs.length, async () => {
  await nextTick()
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight
  }
})
</script>

<style scoped>
.battle-log {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.log-entry {
  padding: 4px 0;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: baseline;
  line-height: 1.5;
}

.log-turn {
  font-weight: bold;
  color: #f5a623;
  min-width: 26px;
  flex-shrink: 0;
}

.log-action {
  color: #ccc;
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.log-details {
  color: #777;
  font-style: italic;
  width: 100%;
}

.log-empty {
  color: #555;
  text-align: center;
  padding: 20px;
  font-size: 13px;
}
</style>
