<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
withDefaults(
  defineProps<{
    title: string
    showBack?: boolean
    active?: 'play' | 'gallery' | 'rules'
  }>(),
  { showBack: false, active: 'play' },
)
defineEmits<{ back: [] }>()
</script>

<template>
  <header class="page-header">
    <div class="header-brand">
      <button
        v-if="showBack"
        type="button"
        class="header-back"
        aria-label="返回上一页"
        @click="$emit('back')"
      >
        <ArrowLeft :size="18" aria-hidden="true" /><span>返回</span>
      </button>
      <a href="#/" class="wordmark" aria-label="邦邦武斗传首页">邦邦武斗传</a>
    </div>
    <nav class="header-nav" aria-label="主导航">
      <a
        href="#/select"
        :class="{ current: active === 'play' }"
        :aria-current="active === 'play' ? 'page' : undefined"
        >对战</a
      >
      <a
        href="#/gallery"
        :class="{ current: active === 'gallery' }"
        :aria-current="active === 'gallery' ? 'page' : undefined"
        >卡牌图鉴</a
      >
      <a
        href="#/gallery?tab=rules"
        :class="{ current: active === 'rules' }"
        :aria-current="active === 'rules' ? 'page' : undefined"
        >规则</a
      >
    </nav>
    <div v-if="$slots.right" class="header-right"><slot name="right" /></div>
  </header>
</template>

<style scoped>
.page-header {
  min-height: 72px;
  padding: 0 clamp(16px, 3.5vw, 56px);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  z-index: var(--z-header);
  flex-shrink: 0;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}
.wordmark {
  font-size: 27px;
  font-weight: 800;
  white-space: nowrap;
  letter-spacing: -0.7px;
  line-height: 1.3;
}
.header-context {
  border-left: 1px solid var(--border);
  padding-left: 20px;
  color: var(--text-dim);
  font-size: 14px;
  white-space: nowrap;
}
.header-back {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  background: transparent;
  border: 0;
  color: var(--text-dim);
}
.header-back:hover {
  color: var(--accent);
}
.header-nav {
  display: flex;
  align-items: stretch;
  gap: 32px;
  height: 72px;
  margin-left: auto;
  white-space: nowrap;
}
.header-nav a {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 3px solid transparent;
  padding-top: 3px;
}
.header-nav a:hover,
.header-nav a.current {
  color: var(--accent);
}
.header-nav a.current {
  border-bottom-color: var(--accent);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 900px) {
  .header-context {
    display: none;
  }
  .header-nav {
    gap: 22px;
  }
}
@media (max-width: 600px) {
  .page-header {
    min-height: 64px;
    gap: 12px;
  }
  .wordmark {
    font-size: 19px;
    letter-spacing: -0.4px;
  }
  .header-brand {
    gap: 10px;
  }
  .header-back span {
    display: none;
  }
  .header-back {
    width: 24px;
    justify-content: center;
  }
  .header-nav {
    height: 64px;
    gap: 14px;
  }
  .header-nav a {
    font-size: 13px;
  }
}
@media (max-width: 359px) {
  .header-nav {
    gap: 10px;
  }
  .header-nav a {
    font-size: 12px;
  }
  .wordmark {
    font-size: 17px;
  }
  .page-header {
    padding-inline: 12px;
    gap: 8px;
  }
}
</style>
