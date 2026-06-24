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
          'slot-shaking': slot.character && animations?.[slot.character.uid]?.type === 'damaged',
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
          <!-- Battle animation overlay -->
          <div
            v-if="animations?.[slot.character.uid]"
            class="anim-overlay"
            :class="`anim-${animations[slot.character.uid].type}`"
          >
            <div class="anim-effect"></div>
            <div
              v-if="animations[slot.character.uid].value !== undefined"
              class="anim-number"
              :class="{
                'num-damage': animations[slot.character.uid].type === 'damaged',
                'num-heal': animations[slot.character.uid].type === 'heal',
              }"
            >
              {{ animations[slot.character.uid].type === 'damaged' ? '-' : '+' }}{{ animations[slot.character.uid].value }}
            </div>
            <div v-if="animations[slot.character.uid].type === 'block'" class="anim-shield">
              <svg viewBox="0 0 24 24" class="shield-icon"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
            </div>
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
  animations?: Record<string, { type: string; value?: number; duration: number }>
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

/* ---- Battle Animations ---- */
.slot-shaking {
  animation: slot-shake 0.4s ease-out;
}

@keyframes slot-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-6px) rotate(-1deg); }
  30% { transform: translateX(5px) rotate(1deg); }
  45% { transform: translateX(-4px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
}

.anim-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Attack: sword slash flash */
.anim-attack .anim-effect {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(245,166,35,0.6) 45%, rgba(255,255,255,0.8) 50%, rgba(245,166,35,0.6) 55%, transparent 70%);
  animation: slash-flash 0.4s ease-out forwards;
  border-radius: 8px;
}

@keyframes slash-flash {
  0% { opacity: 0; transform: translateX(-100%) rotate(-45deg); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateX(100%) rotate(-45deg); }
}

/* Damaged: red pulse */
.anim-damaged .anim-effect {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(233,69,96,0.5) 0%, transparent 70%);
  animation: damage-pulse 0.5s ease-out forwards;
  border-radius: 8px;
}

@keyframes damage-pulse {
  0% { opacity: 0; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0; transform: scale(1.3); }
}

/* Block: blue shield flash */
.anim-block .anim-effect {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(96,165,250,0.4) 0%, transparent 70%);
  animation: block-flash 0.5s ease-out forwards;
  border-radius: 8px;
}

@keyframes block-flash {
  0% { opacity: 0; transform: scale(0.5); }
  40% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0; transform: scale(1.2); }
}

.anim-shield {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: shield-appear 0.6s ease-out forwards;
}

.shield-icon {
  width: 48px;
  height: 48px;
  fill: rgba(96,165,250,0.8);
  filter: drop-shadow(0 0 8px rgba(96,165,250,0.6));
}

@keyframes shield-appear {
  0% { opacity: 0; transform: scale(0.3); }
  30% { opacity: 1; transform: scale(1.2); }
  60% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1); }
}

/* Heal: green pulse */
.anim-heal .anim-effect {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(74,222,128,0.4) 0%, transparent 70%);
  animation: heal-pulse 0.6s ease-out forwards;
  border-radius: 8px;
}

@keyframes heal-pulse {
  0% { opacity: 0; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.15); }
}

/* Floating numbers */
.anim-number {
  position: absolute;
  top: 10%;
  font-size: 28px;
  font-weight: 900;
  text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  animation: float-up 0.8s ease-out forwards;
  z-index: 25;
}

.num-damage { color: #e94560; }
.num-heal { color: #4ade80; }

@keyframes float-up {
  0% { opacity: 0; transform: translateY(20px) scale(0.5); }
  20% { opacity: 1; transform: translateY(0) scale(1.2); }
  50% { opacity: 1; transform: translateY(-10px) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.8); }
}

/* Deploy: center burst */
.anim-deploy .anim-effect {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%);
  animation: deploy-burst 0.6s ease-out forwards;
  border-radius: 8px;
}

@keyframes deploy-burst {
  0% { opacity: 0; transform: scale(0); }
  40% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.5); }
}

/* Near-death: red border pulse */
.anim-near-death .anim-effect {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(233,69,96,0.8);
  border-radius: 8px;
  animation: near-death-pulse 0.8s ease-in-out infinite;
  box-shadow: inset 0 0 20px rgba(233,69,96,0.4);
}

@keyframes near-death-pulse {
  0%, 100% { opacity: 0.3; border-color: rgba(233,69,96,0.3); }
  50% { opacity: 1; border-color: rgba(233,69,96,0.9); }
}
</style>
