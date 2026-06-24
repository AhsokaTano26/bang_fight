import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, PlayerState, TurnPhase } from '../types/game'

export const useGameStore = defineStore('game', () => {
  // State
  const gameState = ref<GameState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedCardUid = ref<string | null>(null)
  const selectedTarget = ref<string | null>(null)

  // Getters
  const currentPlayer = computed(() => {
    if (!gameState.value) return null
    return gameState.value.players[gameState.value.currentPlayerIndex]
  })

  const isMyTurn = computed(() => {
    return !currentPlayer.value?.isAi
  })

  const turnPhase = computed(() => gameState.value?.turnPhase ?? 'ended')

  const playerState = computed(() => {
    return gameState.value?.players.find(p => !p.isAi) ?? null
  })

  const aiPlayers = computed(() => {
    return gameState.value?.players.filter(p => p.isAi) ?? []
  })

  const handCards = computed(() => playerState.value?.hand ?? [])
  const deployedCharacters = computed(() => playerState.value?.deployed ?? [])

  // Actions
  const PLAYER_ID = 'player_0' // First human player

  async function createGame(playerCount = 1, aiCount = 1) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('http://localhost:3000/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount, aiCount }),
      })
      const data = await res.json()
      if (data.success && data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function submitAction(type: string, params: Record<string, any> = {}) {
    if (!gameState.value) return
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`http://localhost:3000/game/${gameState.value.gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          playerId: PLAYER_ID,
          params,
        }),
      })
      const data = await res.json()
      if (data.state) {
        gameState.value = data.state as GameState
      }
      if (data.message && !data.success) {
        error.value = data.message
      }
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchState() {
    if (!gameState.value) return
    try {
      const res = await fetch(`http://localhost:3000/game/${gameState.value.gameId}/state`)
      const data = await res.json()
      if (data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      error.value = String(e)
    }
  }

  async function triggerAiTurn() {
    if (!gameState.value) return
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`http://localhost:3000/game/${gameState.value.gameId}/ai-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function startTurn() {
    await submitAction('startTurn')
  }

  function selectCard(uid: string | null) {
    selectedCardUid.value = uid
    selectedTarget.value = null
  }

  function selectTarget(targetId: string | null) {
    selectedTarget.value = targetId
  }

  return {
    gameState,
    loading,
    error,
    selectedCardUid,
    selectedTarget,
    currentPlayer,
    isMyTurn,
    turnPhase,
    playerState,
    aiPlayers,
    handCards,
    deployedCharacters,
    createGame,
    submitAction,
    fetchState,
    triggerAiTurn,
    startTurn,
    selectCard,
    selectTarget,
  }
})
