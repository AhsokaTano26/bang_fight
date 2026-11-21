<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDialog from './ui/AppDialog.vue'
import { CARD_FACTIONS, getCatalogEntry } from '../types/card-catalog'

const props = defineProps<{ cardId: string | null }>()
const emit = defineEmits<{ 'update:cardId': [value: string | null] }>()
const card = computed(() =>
  props.cardId ? getCatalogEntry(props.cardId) : undefined,
)
const imageLoaded = ref(false)
const imageFailed = ref(false)
watch(
  () => props.cardId,
  () => {
    imageLoaded.value = false
    imageFailed.value = false
  },
)
const faction = computed(() =>
  CARD_FACTIONS.find((f) => f.id === card.value?.faction),
)
const categoryLabel = computed(() => {
  if (card.value?.category === 'strategy')
    return card.value.strategyType === 'deployable' ? '道具牌' : '即时牌'
  return (
    (
      {
        character: '角色牌',
        action: '行动牌',
        auxiliary: '辅助牌',
        marker: '状态标记',
        board: '对战板',
      } as Record<string, string>
    )[card.value?.category ?? ''] ?? '卡牌'
  )
})
const keywordLabels: Record<string, string> = {
  guardian: '守护',
  ignoreGuardian: '无视守护',
  armorPierce: '破甲',
}
</script>

<template>
  <AppDialog
    :model-value="Boolean(cardId && card)"
    :title="card?.name ?? '卡牌详情'"
    :description="card ? `${categoryLabel} · ${card.id}` : ''"
    wide
    @update:model-value="(open) => !open && emit('update:cardId', null)"
  >
    <div v-if="card" class="card-preview-layout">
      <div class="preview-art" :aria-busy="!imageLoaded && !imageFailed">
        <p
          v-if="!imageLoaded"
          class="preview-image-feedback"
          :role="imageFailed ? 'alert' : 'status'"
        >
          {{
            imageFailed ? '卡面暂时没能加载，请关闭后重试。' : '正在加载卡面…'
          }}
        </p>
        <img
          :src="'/' + card.imageFile"
          :alt="card.name + '完整卡面'"
          :width="card.width"
          :height="card.height"
          decoding="async"
          :class="{ 'preview-image-loading': !imageLoaded }"
          @load="imageLoaded = true"
          @error="imageFailed = true"
        />
      </div>
      <div class="preview-copy">
        <p v-if="faction" class="preview-faction">
          <span :style="{ background: faction.color }" />{{ faction.name }}
        </p>
        <dl v-if="card.category === 'character'" class="printed-stats">
          <div>
            <dt>活力 VIT</dt>
            <dd>{{ card.maxHp }}</dd>
          </div>
          <div>
            <dt>攻击 ATK</dt>
            <dd>{{ card.attack }}</dd>
          </div>
        </dl>
        <p v-if="card.attribute" class="preview-attribute">
          花色 · {{ card.attribute }}
        </p>
        <p v-if="card.keywords?.length" class="preview-keywords">
          {{
            card.keywords
              .map((keyword) => keywordLabels[keyword] ?? keyword)
              .join(' · ')
          }}
        </p>
        <section
          v-for="skill in card.skills"
          :key="skill.name"
          class="printed-skill"
        >
          <h3>
            {{ skill.name
            }}<span v-if="skill.consumeActionPoint">消耗行动点</span>
          </h3>
          <p>{{ skill.description }}</p>
        </section>
        <p v-if="card.description" class="printed-description">
          {{ card.description }}
        </p>
        <p class="preview-note">
          图鉴展示 V1.9 卡面。对战使用当前已支持的卡牌与技能规则。
        </p>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.card-preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
.preview-art {
  position: relative;
  display: flex;
  justify-content: center;
  min-width: 0;
  background: var(--bg-primary);
  border-radius: var(--radius);
  padding: 12px;
}
.preview-art img {
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 66svh;
  object-fit: contain;
  border-radius: 7px;
}
.preview-image-feedback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  margin: 0;
  text-align: center;
  color: var(--text-dim);
  font-size: 14px;
}
.preview-image-loading {
  opacity: 0;
}
.preview-copy {
  min-width: 0;
}
.preview-faction {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin: 0 0 20px;
  color: var(--text-dim);
}
.preview-faction > span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.printed-stats {
  display: flex;
  gap: 40px;
  margin: 0 0 24px;
  padding: 0 0 20px;
  border-bottom: 1px solid var(--border);
}
.printed-stats dt {
  color: var(--text-dim);
  font-size: 12px;
}
.printed-stats dd {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.4;
}
.preview-attribute,
.preview-keywords {
  color: var(--text-dim);
  font-size: 14px;
  margin: 0 0 20px;
}
.printed-skill {
  margin: 0 0 24px;
}
.printed-skill h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
  font-size: 17px;
}
.printed-skill h3 span {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}
.printed-skill p,
.printed-description {
  margin: 0;
  font-size: 15px;
  line-height: 1.85;
}
.preview-note {
  padding-top: 20px;
  margin: 28px 0 0;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
}
@media (max-width: 600px) {
  .card-preview-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .preview-art img {
    max-height: 44svh;
  }
  .printed-stats {
    margin-bottom: 20px;
  }
}
</style>
