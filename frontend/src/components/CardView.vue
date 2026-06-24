<template>
  <div
    class="card-container"
    :class="{
      'card-selected': selected,
      'card-rotated': rotated,
      'card-small': small,
      'card-mini': mini,
    }"
    @click="$emit('click')"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="card-inner">
      <img
        v-if="imageFile"
        :src="`/${imageFile}`"
        :alt="name"
        class="card-image"
        loading="lazy"
      />
      <div v-else class="card-placeholder">
        <span class="card-placeholder-text">{{ name }}</span>
      </div>
      <!-- Card name overlay -->
      <div v-if="detailData" class="card-name-overlay" :class="`cat-${detailData.category}`">
        {{ name }}
      </div>
    </div>
    <!-- HP/AP overlay for deployed characters -->
    <div v-if="showStats" class="card-stats">
      <span class="card-hp" v-if="hp !== undefined">
        <span class="hp-icon">+</span> {{ hp }}
      </span>
      <span class="card-atk" v-if="attack !== undefined">
        <span class="atk-icon">&#9876;</span> {{ attack }}
      </span>
    </div>
    <!-- AP indicator -->
    <div v-if="hasActionPoint !== undefined" class="card-ap" :class="{ 'ap-used': !hasActionPoint }">
      {{ hasActionPoint ? '1 AP' : '0 AP' }}
    </div>

    <!-- Detail popup on hover -->
    <Teleport to="body">
      <Transition name="detail-fade">
        <div v-if="showDetail && detailData" class="card-detail-overlay"
          @mouseenter="onDetailEnter" @mouseleave="onDetailLeave">
          <div class="card-detail">
            <div class="detail-image">
              <img :src="`/${detailData.imageFile}`" :alt="detailData.name" />
            </div>
            <div class="detail-info">
              <h3 class="detail-name">{{ detailData.name }}</h3>
              <div v-if="detailData.category === 'character'" class="detail-stats">
                <span class="detail-hp">体力 {{ detailData.maxHp }}</span>
                <span class="detail-atk">攻击 {{ detailData.attack }}</span>
                <span class="detail-faction">{{ factionName(detailData.faction) }}</span>
              </div>
              <div v-if="detailData.category === 'action'" class="detail-stats">
                <span class="detail-type">{{ actionTypeName(detailData.actionType) }}</span>
                <span v-if="detailData.armorPierce" class="detail-tag">无视护甲</span>
                <span v-if="detailData.affectsAll" class="detail-tag">全体</span>
              </div>
              <div v-if="detailData.category === 'action'" class="detail-skill">
                <span class="skill-desc">{{ getActionDescription(detailData.actionType) }}</span>
              </div>
              <div v-if="detailData.category === 'strategy'" class="detail-stats">
                <span class="detail-type">{{ detailData.strategyType === 'deployable' ? '道具牌' : '即时牌' }}</span>
                <span v-if="detailData.requiresTarget" class="detail-tag">需要目标</span>
              </div>
              <div v-if="detailData.category === 'strategy'" class="detail-skill">
                <span class="skill-desc">{{ getStrategyDescription(detailData.id) }}</span>
              </div>
              <div v-if="detailData.category === 'character' && detailData.skills.length" class="detail-skill">
                <span class="skill-name">【{{ detailData.skills[0].name }}】</span>
                <span class="skill-desc">{{ detailData.skills[0].description }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getCardById, ACTION_CARD_DESCRIPTIONS, STRATEGY_CARD_DESCRIPTIONS } from '../types/cards-data'

const props = defineProps<{
  cardId?: string
  imageFile?: string
  name: string
  selected?: boolean
  rotated?: boolean
  small?: boolean
  mini?: boolean
  showStats?: boolean
  hp?: number
  attack?: number
  hasActionPoint?: boolean
}>()

defineEmits<{
  click: []
}>()

const showDetail = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const detailData = computed(() => {
  if (!props.cardId) return null
  return getCardById(props.cardId)
})

function factionName(faction: string): string {
  const names: Record<string, string> = {
    AG: 'Poppin\'Party',
    PPP: 'Poppin\'Party',
    ROS: 'Roselia',
    HHW: 'Hello, Happy World!',
    PAS: 'Pastel*Palettes',
  }
  return names[faction] ?? faction
}

function actionTypeName(type: string): string {
  const names: Record<string, string> = {
    attack: '攻击',
    armorPierce: '破甲攻击',
    bigBlock: '防御（全体）',
    smallBlock: '格挡',
    recovery: '回复',
    bigRecovery: '回复（全体）',
    replenish: '补充',
  }
  return names[type] ?? type
}

function getActionDescription(type: string): string {
  return ACTION_CARD_DESCRIPTIONS[type] ?? '未知效果'
}

function getStrategyDescription(cardId: string): string {
  return STRATEGY_CARD_DESCRIPTIONS[cardId] ?? '未知效果'
}

function onMouseEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showDetail.value = true
}

function onMouseLeave() {
  hideTimer = setTimeout(() => { showDetail.value = false }, 100)
}

function onDetailEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function onDetailLeave() {
  hideTimer = setTimeout(() => { showDetail.value = false }, 100)
}
</script>

<style scoped>
.card-container {
  position: relative;
  width: 140px;
  height: 198px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  border: 2px solid transparent;
  flex-shrink: 0;
  user-select: none;
}

.card-container:hover {
  transform: translateY(-10px) scale(1.06);
  z-index: 10;
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
}

.card-selected {
  border-color: #f5a623 !important;
  box-shadow: 0 0 20px rgba(245, 166, 35, 0.6);
  transform: translateY(-14px) scale(1.1);
}

.card-rotated {
  transform: rotate(180deg);
}

.card-rotated:hover {
  transform: rotate(180deg) translateY(-10px) scale(1.06);
}

.card-small {
  width: 110px;
  height: 156px;
}

.card-mini {
  width: 80px;
  height: 113px;
}

.card-inner {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #2a1a3e;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-name-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3px 4px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}

.card-small .card-name-overlay {
  font-size: 9px;
  padding: 2px 3px;
}

.card-mini .card-name-overlay {
  font-size: 8px;
  padding: 1px 2px;
}

.cat-strategy {
  background: linear-gradient(transparent, rgba(34, 197, 94, 0.85));
}

.cat-action {
  background: linear-gradient(transparent, rgba(233, 69, 96, 0.85));
}

.cat-character {
  background: linear-gradient(transparent, rgba(96, 165, 250, 0.85));
}

.card-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a1a3e, #1a1a2e);
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 8px;
}

.card-stats {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
}

.card-hp, .card-atk {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}

.card-hp { color: #ff6b81; }
.card-atk { color: #f5a623; }

.hp-icon { color: #ff6b81; }
.atk-icon { color: #f5a623; }

.card-ap {
  position: absolute;
  left: 3px;
  bottom: 3px;
  background: rgba(0, 0, 0, 0.75);
  color: #4ade80;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  pointer-events: none;
}

.ap-used {
  color: #666;
}

/* Detail popup */
.card-detail-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: auto;
}

.card-detail {
  width: 420px;
  max-height: 85vh;
  background: #1a1a2e;
  border: 2px solid rgba(233, 69, 96, 0.5);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.detail-image {
  width: 100%;
  flex-shrink: 0;
  overflow: hidden;
}

.detail-image img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  max-height: 450px;
}

.detail-info {
  padding: 14px 16px;
  overflow-y: auto;
  flex: 1;
}

.detail-name {
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 8px;
  color: #fff;
}

.detail-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.detail-hp {
  background: rgba(255, 107, 129, 0.15);
  color: #ff6b81;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.detail-atk {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.detail-faction {
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.detail-type {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.detail-tag {
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.detail-skill {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
  line-height: 1.6;
}

.skill-name {
  color: #f5a623;
  font-weight: 700;
  font-size: 14px;
}

.skill-desc {
  color: #ccc;
  font-size: 13px;
}

/* Transition */
.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
</style>
