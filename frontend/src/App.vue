<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import GameBoard from './components/GameBoard.vue'
import CardTestPage from './components/CardTestPage.vue'

const isTest = ref(window.location.hash === '#test')

function onHashChange() {
  isTest.value = window.location.hash === '#test'
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <CardTestPage v-if="isTest" />
  <GameBoard v-else />
</template>
