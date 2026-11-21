<template>
  <div
    class="card-container"
    :class="{
      'card-selected': selected,
      'card-small': small,
      'card-mini': mini,
    }"
  >
    <button
      type="button"
      class="card-select"
      :disabled="disabled"
      :aria-label="`选择${name}`"
      :aria-pressed="!!selected"
      @click="$emit('click')"
    >
      <span class="card-art" :class="{ 'card-rotated': rotated }">
        <img
          v-if="smallImageFile"
          :src="`/${smallImageFile}`"
          :alt="name"
          class="card-image"
          loading="lazy"
          decoding="async"
        />
        <span v-else class="card-placeholder">{{ name }}</span>
      </span>
      <span v-if="showStats || hasActionPoint !== undefined" class="card-stats">
        <span v-if="showStats && hp !== undefined" class="card-hp"
          >HP {{ hp }}</span
        >
        <span v-if="showStats && attack !== undefined" class="card-atk"
          >攻 {{ attack }}</span
        >
        <span
          v-if="hasActionPoint !== undefined"
          class="card-ap"
          :class="{ 'ap-used': !hasActionPoint }"
          >{{ hasActionPoint ? '1' : '0' }} AP</span
        >
      </span>
    </button>
    <button
      v-if="cardId"
      type="button"
      class="card-inspect"
      :aria-label="`查看${name}详情`"
      @click="previewId = cardId"
    >
      查看详情
    </button>
    <CardPreviewDialog v-model:card-id="previewId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getCatalogEntry } from '../types/card-catalog'
import CardPreviewDialog from './CardPreviewDialog.vue'

const props = defineProps<{
  cardId?: string
  imageFile?: string
  name: string
  selected?: boolean
  rotated?: boolean
  small?: boolean
  mini?: boolean
  disabled?: boolean
  showStats?: boolean
  hp?: number
  attack?: number
  hasActionPoint?: boolean
}>()
defineEmits<{ click: [] }>()
const previewId = ref<string | null>(null)
const smallImageFile = computed(
  () =>
    (props.cardId && getCatalogEntry(props.cardId)?.thumbnailFile) ||
    props.imageFile,
)
</script>

<style scoped>
.card-container {
  width: 136px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  transition:
    border-color 150ms,
    box-shadow 150ms;
}
.card-small {
  width: var(--deployed-card-width, 112px);
}
.card-mini {
  width: 88px;
}
.card-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
.card-select {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.card-select:hover:not(:disabled) {
  background: var(--bg-primary);
}
.card-select:disabled {
  opacity: 1;
  cursor: default;
}
.card-art {
  display: block;
  width: 100%;
  aspect-ratio: 110 / 156;
  overflow: hidden;
}
.card-rotated {
  transform: rotate(180deg);
}
.card-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.card-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 12px;
  color: var(--text-dim);
  background: var(--bg-primary);
}
.card-stats {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 2px 4px;
  padding: 5px 3px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.card-hp {
  color: var(--accent);
}
.card-atk {
  color: var(--text-dim);
}
.card-ap {
  color: var(--success, #32744a);
}
.ap-used {
  color: var(--text-dim);
}
.card-inspect {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 8px 4px;
  border: 0;
  border-top: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
}
.card-inspect:hover {
  color: var(--accent);
  background: var(--bg-primary);
}
.card-select:focus-visible,
.card-inspect:focus-visible {
  position: relative;
  z-index: 1;
  outline: 3px solid var(--accent);
  outline-offset: -3px;
}
@media (prefers-reduced-motion: reduce) {
  .card-container {
    transition: none;
  }
}
</style>
