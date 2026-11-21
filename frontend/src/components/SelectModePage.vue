<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import PageHeader from './PageHeader.vue'
const emit = defineEmits<{
  navigate: [page: string]
  startGame: [playerCount: number, aiCount: number]
}>()
const modes = [
  {
    opponents: 1,
    name: '单人对战',
    title: '1 对 1',
    description: '与一名电脑对手交锋，熟悉每张牌的用法。',
  },
  {
    opponents: 2,
    name: '三人混战',
    title: '1 对 2',
    description: '观察两名对手的局面，选择合适的出手时机。',
  },
  {
    opponents: 3,
    name: '四人混战',
    title: '1 对 3',
    description: '在更复杂的牌桌上，留好你的下一步。',
  },
]
</script>

<template>
  <div class="select-page">
    <PageHeader title="选择对战" show-back @back="emit('navigate', 'home')" />
    <main class="select-main page-container">
      <h1>今天，几个人的牌桌？</h1>
      <p class="select-intro">选择对手数量，直接开始一局。</p>
      <div class="mode-grid">
        <button
          v-for="mode in modes"
          :key="mode.opponents"
          class="mode-option"
          type="button"
          :aria-label="mode.name + '，' + mode.title"
          @click="emit('startGame', 1, mode.opponents)"
        >
          <span class="mode-count">{{ mode.title }}</span>
          <span class="mode-name">{{ mode.name }}</span>
          <span class="mode-description">{{ mode.description }}</span>
          <span class="mode-enter"
            >开始对战<ArrowRight :size="20" aria-hidden="true"
          /></span>
        </button>
      </div>
      <a class="rules-link" href="#/gallery?tab=rules"
        >第一次玩？先看看规则速查 <ArrowRight :size="16" aria-hidden="true"
      /></a>
    </main>
  </div>
</template>

<style scoped>
.select-page {
  min-height: 100svh;
}
.select-main {
  max-width: 1120px;
  padding-top: clamp(48px, 9vh, 100px);
  padding-bottom: 64px;
}
.select-main h1 {
  font-size: clamp(28px, 3.2vw, 44px);
  line-height: 1.35;
  letter-spacing: -1px;
  margin: 0 0 12px;
  font-weight: 750;
}
.select-intro {
  color: var(--text-dim);
  margin: 0 0 44px;
  font-size: 16px;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.mode-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  min-width: 0;
}
.mode-option:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}
.mode-count {
  font-size: 42px;
  font-weight: 750;
  letter-spacing: -1px;
  line-height: 1.3;
  margin-bottom: 24px;
}
.mode-name {
  font-size: 20px;
  font-weight: 650;
  margin-bottom: 8px;
}
.mode-description {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.8;
  min-height: 76px;
}
.mode-enter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--accent);
  width: 100%;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  font-size: 15px;
  font-weight: 600;
}
.rules-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin-top: 32px;
  font-size: 14px;
  color: var(--text-dim);
}
.rules-link:hover {
  color: var(--accent);
}
@media (max-width: 800px) {
  .mode-grid {
    gap: 16px;
  }
  .mode-option {
    padding: 24px;
  }
  .mode-count {
    font-size: 36px;
  }
}
@media (max-width: 600px) {
  .select-main {
    padding-top: 36px;
  }
  .select-intro {
    margin-bottom: 28px;
  }
  .mode-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .mode-option {
    display: grid;
    grid-template-columns: 80px 1fr;
    column-gap: 24px;
    row-gap: 4px;
    padding: 24px;
  }
  .mode-count {
    grid-row: 1 / 4;
    font-size: 30px;
    margin: 0;
    align-self: center;
  }
  .mode-name {
    margin: 0;
    font-size: 18px;
  }
  .mode-description {
    min-height: auto;
  }
  .mode-enter {
    grid-column: 2;
    margin-top: 12px;
    padding-top: 12px;
  }
}
@media (max-width: 359px) {
  .mode-option {
    grid-template-columns: 62px 1fr;
    gap: 4px 16px;
    padding: 20px;
  }
  .mode-count {
    font-size: 27px;
  }
}
</style>
