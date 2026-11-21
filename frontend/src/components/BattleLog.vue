<template>
  <div
    class="battle-log"
    role="log"
    aria-label="对局记录"
    aria-live="polite"
    aria-relevant="additions"
  >
    <ol class="log-entries" ref="logRef" aria-label="对局记录列表" tabindex="0">
      <li v-for="(entry, i) in logs" :key="i" class="log-entry">
        <span class="log-turn">第 {{ entry.turn }} 回合</span
        ><span class="log-action">{{ entry.action }}</span
        ><span v-if="entry.details" class="log-details">{{
          entry.details
        }}</span>
      </li>
      <li v-if="!logs.length" class="log-empty">
        对局开始后，记录会显示在这里。
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { BattleLogEntry } from '../types/game'
const props = defineProps<{ logs: BattleLogEntry[] }>()
const logRef = ref<HTMLElement>()
watch(
  () => props.logs.length,
  async () => {
    const el = logRef.value
    const nearEnd = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60
    await nextTick()
    if (logRef.value && nearEnd)
      logRef.value.scrollTop = logRef.value.scrollHeight
  },
)
</script>

<style scoped>
.battle-log {
  min-width: 0;
}
.log-entries {
  max-height: 660px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 0 4px 0 0;
  list-style: none;
  scrollbar-width: thin;
}
.log-entry {
  display: grid;
  gap: 3px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.log-turn {
  color: var(--text-dim);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.log-action {
  color: var(--text);
}
.log-details {
  color: var(--text-dim);
  font-size: 12px;
}
.log-empty {
  padding: 16px 0;
  color: var(--text-dim);
  font-size: 13px;
}
@media (max-width: 1100px) {
  .log-entries {
    max-height: 260px;
  }
}
</style>
