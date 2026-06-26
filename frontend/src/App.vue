<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import GameBoard from './components/GameBoard.vue'
import CardTestPage from './components/CardTestPage.vue'
import CardGalleryPage from './components/CardGalleryPage.vue'

const currentHash = ref(window.location.hash)

function onHashChange() {
  currentHash.value = window.location.hash
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <CardTestPage v-if="currentHash === '#test'" />
  <CardGalleryPage v-else-if="currentHash === '#gallery'" />
  <GameBoard v-else />
</template>
