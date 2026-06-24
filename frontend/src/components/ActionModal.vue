<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('cancel')">
        <div class="modal-container" @click.stop>
          <button class="modal-close" @click="$emit('cancel')">&times;</button>

          <!-- Card preview -->
          <div class="modal-header">
            <div class="modal-card-preview">
              <img v-if="cardImage" :src="`/${cardImage}`" :alt="cardName" />
            </div>
            <div class="modal-card-info">
              <h3 class="modal-card-name">{{ cardName }}</h3>
              <span class="modal-card-type" :class="typeClass">{{ typeName }}</span>
              <p class="modal-card-desc">{{ cardDesc }}</p>
              <div v-if="cardHp !== undefined" class="modal-card-stats">
                <span class="stat-hp">体力 {{ cardHp }}</span>
                <span class="stat-atk">攻击 {{ cardAtk }}</span>
              </div>
            </div>
          </div>

          <!-- Step progress -->
          <div class="step-progress" v-if="totalSteps > 1">
            <div v-for="s in totalSteps" :key="s" class="step-item" :class="{ 'step-done': s < step, 'step-active': s === step }">
              <div class="step-circle">
                <span v-if="s < step">&#10003;</span>
                <span v-else>{{ s }}</span>
              </div>
              <span v-if="s < totalSteps" class="step-line" :class="{ 'line-done': s < step }"></span>
            </div>
          </div>
          <p class="step-label">{{ stepLabel }}</p>

          <!-- Content -->
          <div class="modal-content">
            <!-- Select Attacker -->
            <div v-if="stepType === 'selectAttacker'" class="select-grid">
              <div
                v-for="slot in myDeployed.filter(s => s.character)"
                :key="slot.character!.uid"
                class="select-card"
                :class="{ 'sel-disabled': !slot.character!.hasActionPoint, 'sel-selected': slot.character!.uid === selectedUid }"
                @click="slot.character!.hasActionPoint && $emit('select', slot.character!.uid)"
              >
                <img :src="`/${getCharImg(slot.character!.cardId)}`" class="sel-img" />
                <div class="sel-info">
                  <span class="sel-name">{{ getCharName(slot.character!.cardId) }}</span>
                  <span class="sel-hp">HP {{ slot.character!.currentHp }}/{{ slot.character!.maxHp }}</span>
                  <span class="sel-atk">ATK {{ slot.character!.attack }}</span>
                  <span v-if="!slot.character!.hasActionPoint" class="sel-badge">AP 已用</span>
                </div>
              </div>
              <p v-if="!myDeployed.some(s => s.character)" class="sel-empty">没有可用的角色</p>
            </div>

            <!-- Select Target (enemy) -->
            <div v-if="stepType === 'selectTarget'" class="target-list">
              <div v-for="enemy in enemyPlayers" :key="enemy.id" class="enemy-group">
                <span class="enemy-label">{{ enemy.name }}</span>
                <div class="select-grid">
                  <div
                    v-for="slot in enemy.deployed.filter(s => s.character)"
                    :key="slot.character!.uid"
                    class="select-card sel-enemy"
                    :class="{ 'sel-selected-enemy': slot.character!.uid === selectedUid }"
                    @click="$emit('select', slot.character!.uid, enemy.id)"
                  >
                    <img :src="`/${getCharImg(slot.character!.cardId)}`" class="sel-img" />
                    <div class="sel-info">
                      <span class="sel-name">{{ getCharName(slot.character!.cardId) }}</span>
                      <span class="sel-hp">HP {{ slot.character!.currentHp }}/{{ slot.character!.maxHp }}</span>
                      <span class="sel-atk">ATK {{ slot.character!.attack }}</span>
                      <span v-if="slot.character!.state === 'nearDeath'" class="sel-badge-s">濒死</span>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="!hasEnemies" class="sel-empty">没有可攻击的目标</p>
            </div>

            <!-- Select Ally (for block/heal) -->
            <div v-if="stepType === 'selectAlly'" class="select-grid">
              <div
                v-for="slot in myDeployed.filter(s => s.character)"
                :key="slot.character!.uid"
                class="select-card"
                :class="{ 'sel-selected': slot.character!.uid === selectedUid }"
                @click="$emit('select', slot.character!.uid)"
              >
                <img :src="`/${getCharImg(slot.character!.cardId)}`" class="sel-img" />
                <div class="sel-info">
                  <span class="sel-name">{{ getCharName(slot.character!.cardId) }}</span>
                  <span class="sel-hp">HP {{ slot.character!.currentHp }}/{{ slot.character!.maxHp }}</span>
                  <span v-if="slot.character!.state === 'nearDeath'" class="sel-badge-s">濒死</span>
                </div>
              </div>
              <p v-if="!myDeployed.some(s => s.character)" class="sel-empty">没有可选的角色</p>
            </div>

            <!-- Confirm -->
            <div v-if="stepType === 'confirm'" class="confirm-box">
              <p class="confirm-text">{{ confirmSummary }}</p>
              <div v-if="selectedName" class="confirm-chip">
                <img v-if="selectedImage" :src="`/${selectedImage}`" class="confirm-chip-img" />
                <span>{{ selectedName }}</span>
              </div>
            </div>

            <!-- Select Deploy Slot -->
            <div v-if="stepType === 'selectSlot'" class="slot-grid">
              <div
                v-for="i in 5" :key="i"
                class="slot-opt"
                :class="{ 'slot-occupied': myDeployed[i-1]?.character, 'slot-sel': selectedSlot === i-1, 'slot-empty': !myDeployed[i-1]?.character }"
                @click="!myDeployed[i-1]?.character && $emit('select', String(i-1))"
              >
                <template v-if="myDeployed[i-1]?.character">
                  <img :src="`/${getCharImg(myDeployed[i-1].character!.cardId)}`" class="slot-img" />
                  <span class="slot-name">{{ getCharName(myDeployed[i-1].character!.cardId) }}</span>
                </template>
                <template v-else>
                  <span class="slot-num">{{ i }}</span>
                  <span class="slot-hint">空位</span>
                </template>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="mbtn mbtn-cancel" @click="$emit('cancel')">取消</button>
            <button v-if="step > 1" class="mbtn mbtn-back" @click="$emit('back')">上一步</button>
            <button class="mbtn mbtn-ok" :disabled="!canConfirm || loading" @click="$emit('confirm')">
              {{ step >= totalSteps ? '确认使用' : '下一步' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CHARACTER_CARDS } from '../types/cards-data'
import type { DeployedSlot, PlayerState } from '../types/game'

type StepType = 'selectAttacker' | 'selectTarget' | 'selectAlly' | 'confirm' | 'selectSlot'

const props = defineProps<{
  visible: boolean
  step: number
  totalSteps: number
  stepType: StepType
  stepLabel: string
  cardImage: string
  cardName: string
  cardDesc: string
  cardTypeClass: string
  cardTypeName: string
  cardHp?: number
  cardAtk?: number
  selectedUid?: string | null
  selectedSlot?: number | null
  selectedName?: string
  selectedImage?: string
  confirmSummary: string
  myDeployed: DeployedSlot[]
  enemyPlayers: PlayerState[]
  loading?: boolean
}>()

defineEmits<{
  select: [uid: string, playerId?: string]
  confirm: []
  cancel: []
  back: []
}>()

const typeClass = computed(() => props.cardTypeClass)
const typeName = computed(() => props.cardTypeName)
const hasEnemies = computed(() => props.enemyPlayers.some(e => e.deployed.some(s => s.character)))

const canConfirm = computed(() => {
  if (props.stepType === 'selectAttacker' || props.stepType === 'selectTarget' || props.stepType === 'selectAlly') {
    return !!props.selectedUid
  }
  if (props.stepType === 'selectSlot') {
    return props.selectedSlot !== null && props.selectedSlot !== undefined
  }
  return true
})

function getCharImg(cardId: string): string {
  return CHARACTER_CARDS.find(c => c.id === cardId)?.imageFile ?? ''
}

function getCharName(cardId: string): string {
  return CHARACTER_CARDS.find(c => c.id === cardId)?.name ?? cardId
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.modal-container {
  background: #1a1a2e;
  border: 2px solid rgba(233,69,96,0.4);
  border-radius: 16px;
  width: 520px; max-height: 80vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  position: relative; padding: 24px;
}
.modal-close {
  position: absolute; top: 12px; right: 16px;
  background: none; border: none; color: #666; font-size: 24px; cursor: pointer; z-index: 1;
}
.modal-close:hover { color: #fff; }

/* Header */
.modal-header { display: flex; gap: 16px; margin-bottom: 20px; }
.modal-card-preview { width: 90px; height: 127px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #2a1a3e; }
.modal-card-preview img { width: 100%; height: 100%; object-fit: cover; }
.modal-card-info { flex: 1; min-width: 0; }
.modal-card-name { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.modal-card-type { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.type-character { background: rgba(167,139,250,0.2); color: #a78bfa; }
.type-action { background: rgba(96,165,250,0.2); color: #60a5fa; }
.modal-card-desc { font-size: 13px; color: #aaa; margin: 0 0 8px; line-height: 1.5; }
.modal-card-stats { display: flex; gap: 8px; }
.stat-hp { color: #ff6b81; font-size: 13px; font-weight: 600; }
.stat-atk { color: #f5a623; font-size: 13px; font-weight: 600; }

/* Step progress */
.step-progress { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.step-item { display: flex; align-items: center; }
.step-circle {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px;
  background: rgba(255,255,255,0.1); color: #666;
}
.step-active .step-circle { background: #f5a623; color: #000; box-shadow: 0 0 12px rgba(245,166,35,0.4); }
.step-done .step-circle { background: #4ade80; color: #000; }
.step-line { width: 40px; height: 2px; background: rgba(255,255,255,0.1); margin: 0 4px; }
.line-done { background: #4ade80; }
.step-label { text-align: center; font-size: 14px; color: #f5a623; font-weight: 600; margin: 0 0 16px; }

/* Content */
.modal-content { min-height: 160px; margin-bottom: 20px; }
.select-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.select-card {
  border: 2px solid transparent; border-radius: 10px; cursor: pointer;
  transition: all 0.2s; background: rgba(255,255,255,0.03); padding: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.select-card:hover { border-color: rgba(245,166,35,0.4); transform: translateY(-2px); }
.sel-selected { border-color: #f5a623 !important; box-shadow: 0 0 15px rgba(245,166,35,0.3); }
.sel-disabled { opacity: 0.4; cursor: not-allowed; }
.sel-disabled:hover { border-color: transparent; transform: none; }
.sel-enemy:hover { border-color: rgba(233,69,96,0.4); }
.sel-selected-enemy { border-color: #e94560 !important; box-shadow: 0 0 15px rgba(233,69,96,0.3); }
.sel-img { width: 60px; height: 60px; border-radius: 6px; object-fit: cover; }
.sel-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.sel-name { font-size: 12px; font-weight: 600; color: #fff; }
.sel-hp { font-size: 11px; color: #ff6b81; }
.sel-atk { font-size: 11px; color: #f5a623; }
.sel-badge { font-size: 10px; color: #666; background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 3px; }
.sel-badge-s { font-size: 10px; color: #e94560; background: rgba(233,69,96,0.2); padding: 1px 6px; border-radius: 3px; }
.sel-empty { text-align: center; color: #666; font-size: 14px; padding: 30px; }

/* Target list */
.target-list { display: flex; flex-direction: column; gap: 16px; }
.enemy-group { display: flex; flex-direction: column; gap: 8px; }
.enemy-label { font-size: 13px; font-weight: 600; color: #e94560; padding-left: 4px; }

/* Confirm */
.confirm-box { text-align: center; padding: 20px; }
.confirm-text { font-size: 16px; color: #ccc; margin: 0 0 16px; }
.confirm-chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; font-size: 14px; color: #fff; }
.confirm-chip-img { width: 32px; height: 32px; border-radius: 4px; object-fit: cover; }

/* Deploy slots */
.slot-grid { display: flex; gap: 10px; justify-content: center; }
.slot-opt {
  width: 80px; height: 110px; border: 2px solid transparent; border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
}
.slot-empty { border-style: dashed; border-color: rgba(245,166,35,0.3); background: rgba(245,166,35,0.05); }
.slot-empty:hover { border-color: #f5a623; background: rgba(245,166,35,0.1); }
.slot-occupied { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); opacity: 0.5; cursor: not-allowed; }
.slot-sel { border-color: #f5a623 !important; box-shadow: 0 0 12px rgba(245,166,35,0.3); }
.slot-num { font-size: 22px; font-weight: 700; color: rgba(245,166,35,0.5); }
.slot-hint { font-size: 11px; color: #666; margin-top: 4px; }
.slot-img { width: 50px; height: 50px; border-radius: 6px; object-fit: cover; }
.slot-name { font-size: 10px; color: #999; margin-top: 4px; text-align: center; }

/* Footer */
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; }
.mbtn { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.mbtn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #999; }
.mbtn-cancel:hover { border-color: rgba(255,255,255,0.4); color: #ccc; }
.mbtn-back { background: rgba(255,255,255,0.1); color: #ccc; }
.mbtn-back:hover { background: rgba(255,255,255,0.15); }
.mbtn-ok { background: #e94560; color: #fff; }
.mbtn-ok:hover:not(:disabled) { background: #d63a53; }
.mbtn-ok:disabled { background: #444; color: #777; cursor: not-allowed; }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s; }
.modal-fade-enter-active .modal-container, .modal-fade-leave-active .modal-container { transition: transform 0.25s, opacity 0.25s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-container { transform: scale(0.95); opacity: 0; }
.modal-fade-leave-to .modal-container { transform: scale(0.95); opacity: 0; }
</style>
