import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState } from '../types/game'

interface GameResponse {
  success: boolean
  message?: string
  gameId?: string
  state?: GameState
}

const HTTP_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权',
  403: '禁止访问',
  404: '资源未找到',
  408: '请求超时',
  409: '请求冲突',
  429: '请求过于频繁',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
}

async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<GameResponse> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let msg: string
    try {
      const body = (await res.json()) as { message?: string | string[] }
      msg =
        (Array.isArray(body.message)
          ? body.message.join('；')
          : body.message) ||
        HTTP_MESSAGES[res.status] ||
        `HTTP ${res.status}`
    } catch {
      msg = HTTP_MESSAGES[res.status] || `HTTP ${res.status}`
    }
    throw new Error(msg)
  }
  return res.json()
}

export const useGameStore = defineStore('game', () => {
  // State
  const gameState = ref<GameState | null>(null)
  const loadingCount = ref(0)
  const loading = computed(() => loadingCount.value > 0)
  const error = ref<string | null>(null)
  const selectedCardUid = ref<string | null>(null)
  const selectedTarget = ref<string | null>(null)
  let gameGeneration = 0

  // Getters
  const currentPlayer = computed(() => {
    if (!gameState.value) return null
    return gameState.value.players[gameState.value.currentPlayerIndex]
  })

  const isMyTurn = computed(() => {
    if (!currentPlayer.value) return false
    return !currentPlayer.value.isAi
  })

  const turnPhase = computed(() => gameState.value?.turnPhase ?? 'ended')

  const playerState = computed(() => {
    return gameState.value?.players.find((p) => !p.isAi) ?? null
  })

  const aiPlayers = computed(() => {
    return gameState.value?.players.filter((p) => p.isAi) ?? []
  })

  const handCards = computed(() => playerState.value?.hand ?? [])
  const deployedCharacters = computed(() => playerState.value?.deployed ?? [])

  // Actions
  const PLAYER_ID = 'player_0' // First human player

  async function createGame(
    playerCount = 1,
    aiCount = 1,
    signal?: AbortSignal,
  ) {
    if (signal?.aborted) return
    const generation = ++gameGeneration
    gameState.value = null
    selectedCardUid.value = null
    selectedTarget.value = null
    loadingCount.value++
    error.value = null
    try {
      const data = await apiFetch('/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount, aiCount }),
        signal,
      })
      if (signal?.aborted || generation !== gameGeneration) return
      if (data.success && data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      if (!signal?.aborted && generation === gameGeneration)
        error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingCount.value--
    }
  }

  async function submitAction(
    type: string,
    params: Record<string, any> = {},
    signal?: AbortSignal,
  ): Promise<GameResponse | null> {
    if (!gameState.value || signal?.aborted) return null
    const generation = gameGeneration
    const gameId = gameState.value.gameId
    loadingCount.value++
    error.value = null
    try {
      const data = await apiFetch(`/game/${gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          playerId: PLAYER_ID,
          params,
        }),
        signal,
      })
      if (
        signal?.aborted ||
        generation !== gameGeneration ||
        gameState.value?.gameId !== gameId
      )
        return null
      if (data.state) {
        gameState.value = data.state as GameState
      }
      if (data.message && !data.success) {
        error.value = data.message
      }
      return data
    } catch (e) {
      if (!signal?.aborted && generation === gameGeneration)
        error.value = e instanceof Error ? e.message : String(e)
      return null
    } finally {
      loadingCount.value--
    }
  }

  async function fetchState(signal?: AbortSignal) {
    if (!gameState.value || signal?.aborted) return
    const generation = gameGeneration
    const gameId = gameState.value.gameId
    try {
      const data = await apiFetch(`/game/${gameId}/state`, { signal })
      if (
        signal?.aborted ||
        generation !== gameGeneration ||
        gameState.value?.gameId !== gameId
      )
        return
      if (data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      if (!signal?.aborted && generation === gameGeneration)
        error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function triggerAiTurn(signal?: AbortSignal) {
    if (!gameState.value || signal?.aborted) return
    const generation = gameGeneration
    const gameId = gameState.value.gameId
    loadingCount.value++
    error.value = null
    try {
      const data = await apiFetch(`/game/${gameId}/ai-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal,
      })
      if (
        signal?.aborted ||
        generation !== gameGeneration ||
        gameState.value?.gameId !== gameId
      )
        return
      if (data.state) {
        gameState.value = data.state as GameState
      }
    } catch (e) {
      if (!signal?.aborted && generation === gameGeneration)
        error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingCount.value--
    }
  }

  async function startTurn(signal?: AbortSignal) {
    await submitAction('startTurn', {}, signal)
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
