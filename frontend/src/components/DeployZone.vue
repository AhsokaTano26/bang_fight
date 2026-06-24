<template>
  <div class="deploy-zone">
    <div class="deploy-slots">
      <div
        v-for="(slot, i) in slots"
        :key="i"
        class="deploy-slot"
        :class="{
          'slot-occupied': slot.character,
          'slot-targetable': targetable,
          'slot-selected': selectedUid === slot.character?.uid,
          'slot-near-death': slot.character?.state === 'nearDeath',
        }"
        @click="onSlotClick(i, slot)"
      >
        <template v-if="slot.character">
          <CardView
            :cardId="slot.character.cardId"
            :imageFile="getCharacterImage(slot.character.cardId)"
            :name="getCharacterName(slot.character.cardId)"
            :rotated="slot.character.state === 'nearDeath'"
            :small="true"
            :hp="slot.character.currentHp"
            :attack="slot.character.attack"
            :hasActionPoint="slot.character.hasActionPoint"
            :showStats="true"
          />
          <!-- Debuff indicators -->
          <div v-if="slot.character.debuffs.length" class="debuffs">
            <span v-for="d in slot.character.debuffs" :key="d.type" class="debuff-badge" :title="d.type">
              {{ debuffIcon(d.type) }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="empty-slot">
            <span class="empty-slot-number">{{ i + 1 }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CardView from './CardView.vue'
import { CHARACTER_CARDS } from '../types/cards-data'
import type { DeployedSlot } from '../types/game'

const props = defineProps<{
  slots: DeployedSlot[]
  targetable?: boolean
  selectedUid?: string | null
}>()

const emit = defineEmits<{
  select: [uid: string]
  emptySlot: [position: number]
}>()

function getCharacterImage(cardId: string): string {
  const card = CHARACTER_CARDS.find(c => c.id === cardId)
  return card?.imageFile ?? ''
}

function getCharacterName(cardId: string): string {
  const card = CHARACTER_CARDS.find(c => c.id === cardId)
  return card?.name ?? cardId
}

function onSlotClick(position: number, slot: DeployedSlot) {
  if (slot.character) {
    emit('select', slot.character.uid)
  } else {
    emit('emptySlot', position)
  }
}

function debuffIcon(type: string): string {
  const icons: Record<string, string> = {
    weaken: '💀',
    silence: '🔇',
    disarm: '⚔',
  }
  return icons[type] ?? '?'
}
</script>

<style scoped>
.deploy-zone {
  padding: 8px 0;
}

.deploy-slots {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.deploy-slot {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;
}

.slot-occupied:hover {
  transform: scale(1.05);
}

.slot-targetable {
  cursor: crosshair;
}

.slot-selected {
  outline: 2px solid #f5a623;
  outline-offset: 2px;
  border-radius: 8px;
}

.slot-near-death {
  opacity: 0.6;
}

.empty-slot {
  width: 110px;
  height: 156px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.slot-targetable .empty-slot {
  border-color: rgba(245, 166, 35, 0.3);
}

.empty-slot-number {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.1);
}

.debuffs {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.debuff-badge {
  font-size: 12px;
}
</style>
