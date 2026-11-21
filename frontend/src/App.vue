<script setup lang="ts">
import {
  ref,
  watch,
  onMounted,
  onUnmounted,
  defineAsyncComponent,
  nextTick,
} from 'vue'
import { X, CircleAlert } from '@lucide/vue'
import { useGameStore } from './stores/game'
import HomePage from './components/HomePage.vue'
import PageLoading from './components/ui/PageLoading.vue'
import PageLoadError from './components/ui/PageLoadError.vue'

const SelectModePage = defineAsyncComponent({
  loader: () => import('./components/SelectModePage.vue'),
  loadingComponent: PageLoading,
  errorComponent: PageLoadError,
  delay: 120,
  timeout: 15000,
})
const GameBoard = defineAsyncComponent({
  loader: () => import('./components/GameBoard.vue'),
  loadingComponent: PageLoading,
  errorComponent: PageLoadError,
  delay: 120,
  timeout: 15000,
})
const CardGalleryPage = defineAsyncComponent({
  loader: () => import('./components/CardGalleryPage.vue'),
  loadingComponent: PageLoading,
  errorComponent: PageLoadError,
  delay: 120,
  timeout: 15000,
})
const CardTestPage = import.meta.env.DEV
  ? defineAsyncComponent({
      loader: () => import('./components/CardTestPage.vue'),
      loadingComponent: PageLoading,
      errorComponent: PageLoadError,
      delay: 120,
      timeout: 15000,
    })
  : null

type Page = 'home' | 'select' | 'game' | 'gallery' | 'test'
const pageNames: Record<Page, string> = {
  home: '邦邦武斗传',
  select: '选择对战',
  game: '对战',
  gallery: '卡牌图鉴',
  test: '开发测试',
}
function readPage(): Page {
  const page = window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home'
  if (page === 'test' && !import.meta.env.DEV) return 'home'
  return Object.hasOwn(pageNames, page) ? (page as Page) : 'home'
}

const store = useGameStore()
const currentPage = ref<Page>(readPage())
const contentRoot = ref<HTMLElement | null>(null)
const gameConfig = ref<{ playerCount?: number; aiCount?: number }>({})
const errorMsg = ref<string | null>(null)
let dismissTimer: ReturnType<typeof setTimeout> | undefined

function dismissError() {
  errorMsg.value = null
  clearTimeout(dismissTimer)
}
watch(
  () => store.error,
  (value) => {
    if (!value) return
    clearTimeout(dismissTimer)
    errorMsg.value = value
    dismissTimer = setTimeout(dismissError, 7000)
  },
)
watch(
  currentPage,
  async (page) => {
    document.title =
      page === 'home' ? pageNames.home : `${pageNames[page]} · 邦邦武斗传`
    await nextTick()
    contentRoot.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

function focusMain() {
  contentRoot.value?.focus()
}
function onHashChange() {
  currentPage.value = readPage()
}
onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  clearTimeout(dismissTimer)
})
function navigate(page: string) {
  window.location.hash = page === 'home' ? '#/' : `#/${page}`
}
function startGame(playerCount: number, aiCount: number) {
  gameConfig.value = { playerCount, aiCount }
  navigate('game')
}
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusMain"
    >跳转到主要内容</a
  >
  <div id="main-content" ref="contentRoot" tabindex="-1">
    <HomePage v-if="currentPage === 'home'" @navigate="navigate" />
    <SelectModePage
      v-else-if="currentPage === 'select'"
      @navigate="navigate"
      @start-game="startGame"
    />
    <GameBoard
      v-else-if="currentPage === 'game'"
      :start-config="gameConfig"
      @back="navigate('home')"
    />
    <CardGalleryPage
      v-else-if="currentPage === 'gallery'"
      @back="navigate('home')"
    />
    <CardTestPage
      v-else-if="currentPage === 'test' && CardTestPage"
      @back="navigate('home')"
    />
  </div>
  <Transition name="toast">
    <div v-if="errorMsg" class="global-error" role="alert" aria-atomic="true">
      <CircleAlert :size="20" aria-hidden="true" />
      <span>{{ errorMsg }}</span>
      <button type="button" aria-label="关闭错误提示" @click="dismissError">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>

<style>
#main-content:focus {
  outline: none;
}
.global-error {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: min(600px, calc(100vw - 32px));
  padding: 8px 8px 8px 18px;
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  box-shadow: var(--shadow-sm);
  font-size: 14px;
}
.global-error > svg {
  flex-shrink: 0;
}
.global-error button {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: inherit;
  display: grid;
  place-items: center;
  border-radius: 6px;
}
.global-error button:hover {
  background: rgb(183 45 60 / 8%);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 140ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
