<template>
  <div class="deploy-zone">
    <div class="deploy-slots" aria-label="五个部署位置">
      <div
        v-for="(slot, i) in visibleSlots"
        :key="i"
        class="deploy-slot"
        :class="{
          'slot-near-death': slot.character?.state === 'nearDeath',
          'slot-damaged':
            slot.character &&
            animations?.[slot.character.uid]?.type === 'damaged',
        }"
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
            :selected="selectedUid === slot.character.uid"
            :disabled="disabled || !selectable"
            @click="onSlotClick(i, slot)"
          />
          <div
            v-if="
              slot.character.state === 'nearDeath' ||
              slot.character.debuffs.length ||
              slot.equipment
            "
            class="slot-status"
          >
            <span
              v-if="slot.character.state === 'nearDeath'"
              class="status-warning"
              >濒死</span
            >
            <span
              v-for="d in slot.character.debuffs"
              :key="d.type"
              class="status-debuff"
              >{{ debuffName(d.type) }}</span
            >
            <button
              v-if="slot.equipment"
              type="button"
              class="equipment-button"
              :aria-label="`查看装备${getCardById(slot.equipment.cardId)?.name ?? slot.equipment.cardId}`"
              @click="previewId = slot.equipment.cardId"
            >
              装备
            </button>
          </div>
          <div
            v-if="animations?.[slot.character.uid]"
            class="anim-overlay"
            :class="`anim-${animations[slot.character.uid].type}`"
            aria-hidden="true"
          >
            <span
              v-if="animations[slot.character.uid].value !== undefined"
              class="anim-number"
              >{{ animations[slot.character.uid].type === 'damaged' ? '−' : '+'
              }}{{ animations[slot.character.uid].value }}</span
            >
            <span
              v-else-if="animations[slot.character.uid].type === 'block'"
              class="anim-label"
              >格挡</span
            >
            <span
              v-else-if="animations[slot.character.uid].type === 'heal'"
              class="anim-label"
              >回复</span
            >
            <span
              v-else-if="animations[slot.character.uid].type === 'deploy'"
              class="anim-label"
              >部署</span
            >
          </div>
        </template>
        <button
          v-else
          type="button"
          class="empty-slot"
          :disabled="disabled || !targetable"
          :aria-label="`部署位置${i + 1}，空位`"
          @click="onSlotClick(i, slot)"
        >
          <span class="empty-slot-number">{{ i + 1 }}</span
          ><span class="empty-slot-label">空位</span>
        </button>
      </div>
    </div>
    <CardPreviewDialog v-model:card-id="previewId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CardView from './CardView.vue'
import CardPreviewDialog from './CardPreviewDialog.vue'
import { getCardById, CHARACTER_CARDS } from '../types/cards-data'
import type { DeployedSlot } from '../types/game'

const props = withDefaults(
  defineProps<{
    slots: DeployedSlot[]
    targetable?: boolean
    selectable?: boolean
    disabled?: boolean
    selectedUid?: string | null
    animations?: Record<
      string,
      { type: string; value?: number; duration: number }
    >
  }>(),
  { selectable: true },
)
const emit = defineEmits<{
  select: [uid: string]
  emptySlot: [position: number]
}>()
const previewId = ref<string | null>(null)
const visibleSlots = computed(() =>
  Array.from(
    { length: 5 },
    (_, i) =>
      props.slots[i] ?? { position: i, character: null, equipment: null },
  ),
)

function getCharacterImage(cardId: string) {
  return CHARACTER_CARDS.find((c) => c.id === cardId)?.imageFile ?? ''
}
function getCharacterName(cardId: string) {
  return CHARACTER_CARDS.find((c) => c.id === cardId)?.name ?? cardId
}
function onSlotClick(position: number, slot: DeployedSlot) {
  if (props.disabled) return
  if (slot.character && props.selectable) emit('select', slot.character.uid)
  else if (!slot.character && props.targetable) emit('emptySlot', position)
}
function debuffName(type: string) {
  const names: Record<string, string> = {
    weaken: '虚弱',
    silence: '沉默',
    disarm: '缴械',
    skipDraw: '跳过摸牌',
    skipAction: '跳过行动',
    loseAbility: '失去能力',
    earthStore: '地藏',
  }
  return names[type] ?? type
}
</script>

<style scoped>
.deploy-zone {
  min-width: 0;
}
.deploy-slots {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.deploy-slot {
  position: relative;
  width: var(--deployed-card-width, 112px);
  flex: 0 0 var(--deployed-card-width, 112px);
}
.empty-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: var(--deployed-card-width, 112px);
  height: var(--deployed-slot-height, 228px);
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-dim);
  background: transparent;
}
.empty-slot:disabled {
  opacity: 1;
  cursor: default;
}
.empty-slot:not(:disabled):hover {
  border-color: var(--accent);
  background: var(--surface);
}
.empty-slot-number {
  font-size: 24px;
  font-weight: 500;
}
.empty-slot-label {
  font-size: 11px;
}
.slot-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
}
.status-warning,
.status-debuff {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--warning, #8b5f19);
  border: 1px solid var(--border);
}
.equipment-button {
  min-height: 44px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
}
.anim-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  pointer-events: none;
  animation: battle-feedback 800ms ease-out both;
}
.anim-damaged {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}
.anim-heal,
.anim-deploy {
  background: color-mix(in srgb, var(--success, #32744a) 14%, transparent);
  color: var(--success, #32744a);
}
.anim-block,
.anim-attack {
  background: color-mix(in srgb, var(--warning, #8b5f19) 14%, transparent);
  color: var(--warning, #8b5f19);
}
.anim-number,
.anim-label {
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--surface);
  font-size: 22px;
  font-weight: 700;
}
.anim-label {
  font-size: 16px;
}
.slot-damaged {
  animation: damage-nudge 240ms ease-out;
}
@keyframes battle-feedback {
  0% {
    opacity: 0;
  }
  20%,
  65% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes damage-nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  30% {
    transform: translateX(-3px);
  }
  65% {
    transform: translateX(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .anim-overlay,
  .slot-damaged {
    animation: none;
  }
}
</style>
