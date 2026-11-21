<template>
  <section class="card-hand" aria-label="你的手牌">
    <div class="hand-header">
      <h2>
        你的手牌 <span>{{ handCards.length }}</span>
      </h2>
      <span class="hand-hint">选牌使用 · 查看详情</span>
    </div>
    <div class="hand-cards" tabindex="0" aria-label="手牌列表，可横向滚动">
      <CardView
        v-for="card in handCards"
        :key="card.uid"
        :cardId="card.cardId"
        :imageFile="getCardById(card.cardId)?.imageFile"
        :name="getCardById(card.cardId)?.name ?? card.cardId"
        :selected="selectedUid === card.uid"
        :disabled="disabled"
        @click="$emit('selectCard', card.uid)"
      />
      <p v-if="!handCards.length" class="hand-empty">目前没有手牌。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import CardView from './CardView.vue'
import { getCardById } from '../types/cards-data'
import type { CardInstance } from '../types/card'
defineProps<{
  handCards: CardInstance[]
  selectedUid?: string | null
  disabled?: boolean
}>()
defineEmits<{ selectCard: [uid: string] }>()
</script>

<style scoped>
.card-hand {
  min-width: 0;
  max-width: 100%;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.hand-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 12px;
}
.hand-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--text);
}
.hand-header h2 span {
  margin-left: 4px;
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 400;
}
.hand-hint {
  font-size: 12px;
  color: var(--text-dim);
}
.hand-cards {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 3px 3px 10px;
  min-width: 0;
  scrollbar-width: thin;
}
.hand-empty {
  margin: 16px 0;
  color: var(--text-dim);
  font-size: 14px;
}
@media (max-width: 600px) {
  .card-hand {
    padding: 12px;
  }
  .hand-cards {
    gap: 8px;
  }
}
</style>
