<template>
  <div class="card-hand">
    <div class="hand-cards" ref="handRef">
      <div
        v-for="(card, i) in handCards"
        :key="card.uid"
        class="hand-card-wrapper"
        :style="cardStyle(i)"
      >
        <CardView
          :cardId="card.cardId"
          :imageFile="getCardImage(card.cardId)"
          :name="getCardName(card.cardId)"
          :selected="selectedUid === card.uid"
          @click="$emit('selectCard', card.uid)"
        />
      </div>
    </div>
    <div class="hand-info">
      <span class="hand-count">{{ handCards.length }} 张手牌</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import CardView from './CardView.vue'
import { getCardById } from '../types/cards-data'
import type { CardInstance } from '../types/card'

defineProps<{
  handCards: CardInstance[]
  selectedUid?: string | null
}>()

defineEmits<{
  selectCard: [uid: string]
}>()

function getCardImage(cardId: string): string {
  return getCardById(cardId)?.imageFile ?? ''
}

function getCardName(cardId: string): string {
  return getCardById(cardId)?.name ?? cardId
}

function cardStyle(index: number) {
  // Fan spread effect
  const total = 10 // approximate max
  const offset = index - Math.min(total, 10) / 2
  const rotation = offset * 3
  const translateY = Math.abs(offset) * 4
  return {
    transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
    zIndex: index,
  }
}
</script>

<style scoped>
.card-hand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.hand-cards {
  display: flex;
  justify-content: center;
  padding: 24px 60px;
  min-height: 240px;
  perspective: 800px;
}

.hand-card-wrapper {
  margin: 0 -18px;
  transition: transform 0.3s;
}

.hand-card-wrapper:hover {
  z-index: 100 !important;
}

.hand-info {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.hand-count {
  background: rgba(255, 255, 255, 0.05);
  padding: 3px 12px;
  border-radius: 10px;
}
</style>
