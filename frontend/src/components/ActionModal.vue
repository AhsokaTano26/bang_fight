<template>
  <AppDialog
    :model-value="visible"
    :title="cardName || '使用卡牌'"
    :description="stepLabel"
    @update:model-value="(open) => !open && $emit('cancel')"
  >
    <div class="action-modal-body" :aria-busy="loading">
      <div class="modal-header">
        <img
          v-if="previewImage"
          :src="`/${previewImage}`"
          :alt="cardName"
          class="modal-card-preview"
        />
        <div class="modal-card-info">
          <span class="modal-card-type" :class="cardTypeClass">{{
            cardTypeName
          }}</span>
          <p class="modal-card-desc">{{ cardDesc }}</p>
          <div v-if="cardHp !== undefined" class="modal-card-stats">
            <span>体力 {{ cardHp }}</span
            ><span v-if="cardAtk !== undefined">攻击 {{ cardAtk }}</span>
          </div>
        </div>
      </div>

      <ol v-if="totalSteps > 1" class="step-progress" aria-label="出牌步骤">
        <li
          v-for="s in totalSteps"
          :key="s"
          :class="{ 'step-done': s < step, 'step-active': s === step }"
          :aria-current="s === step ? 'step' : undefined"
        >
          <span>{{ s < step ? '✓' : s }}</span>
        </li>
      </ol>
      <p class="step-label" role="status">
        第 {{ step }} / {{ totalSteps }} 步 · {{ stepLabel }}
      </p>

      <div v-if="stepType === 'confirm'" class="confirm-box">
        <p>{{ confirmSummary }}</p>
        <div v-if="selectedName" class="confirm-chip">
          <img
            v-if="selectedThumbnail"
            :src="`/${selectedThumbnail}`"
            :alt="selectedName"
          /><span>{{ selectedName }}</span>
        </div>
      </div>

      <div
        v-else-if="stepType === 'selectSlot'"
        class="slot-grid"
        aria-label="选择部署位置"
      >
        <button
          v-for="i in 5"
          :key="i"
          type="button"
          class="slot-opt"
          :class="{
            'slot-occupied': myDeployed[i - 1]?.character,
            'slot-sel': selectedSlot === i - 1,
          }"
          :disabled="loading || !!myDeployed[i - 1]?.character"
          :aria-pressed="selectedSlot === i - 1"
          :aria-label="`位置${i}，${myDeployed[i - 1]?.character ? '已占用' : '空位'}`"
          @click="$emit('select', String(i - 1))"
        >
          <template v-if="myDeployed[i - 1]?.character"
            ><img
              :src="`/${getCharImg(myDeployed[i - 1]!.character!.cardId)}`"
              :alt="getCharName(myDeployed[i - 1]!.character!.cardId)"
            /><span>{{
              getCharName(myDeployed[i - 1]!.character!.cardId)
            }}</span></template
          >
          <template v-else
            ><strong>{{ i }}</strong
            ><span>空位</span></template
          >
        </button>
      </div>

      <div v-else-if="modeOptions.length" class="mode-grid">
        <button
          v-for="mode in modeOptions"
          :key="mode.id"
          type="button"
          class="mode-card"
          :class="{ 'mode-selected': selectedMode === mode.id }"
          :aria-pressed="selectedMode === mode.id"
          :disabled="loading"
          @click="$emit('selectMode', mode.id)"
        >
          <strong>{{ mode.name }}</strong
          ><span>{{ mode.description }}</span>
        </button>
      </div>

      <div v-else class="target-list">
        <p v-if="excludedUid" class="target-note">
          第一名：{{ excludedTargetName }}。请选择另一名角色。
        </p>
        <section
          v-for="group in selectionGroups"
          :key="group.id"
          class="target-group"
        >
          <h3 v-if="group.label">{{ group.label }}</h3>
          <div class="select-grid">
            <button
              v-for="choice in group.choices"
              :key="choice.uid"
              type="button"
              class="select-card"
              :class="{ 'sel-selected': choice.uid === selectedUid }"
              :disabled="loading || choice.disabled"
              :aria-pressed="choice.uid === selectedUid"
              @click="$emit('select', choice.uid, choice.playerId)"
            >
              <img
                v-if="choice.image"
                :src="`/${choice.image}`"
                :alt="choice.name"
                class="sel-img"
              />
              <span class="sel-info"
                ><strong>{{ choice.name }}</strong
                ><span class="sel-hp"
                  >HP {{ choice.hp }}/{{ choice.maxHp }}</span
                ><span v-if="choice.attack !== undefined"
                  >攻击 {{ choice.attack }}</span
                ><span v-if="choice.badge" class="sel-badge">{{
                  choice.badge
                }}</span></span
              >
            </button>
          </div>
          <p v-if="!group.choices.length" class="sel-empty">没有可选的角色。</p>
        </section>
        <p v-if="!selectionGroups.length" class="sel-empty">没有可选的目标。</p>
      </div>
    </div>
    <template #footer>
      <div class="modal-footer">
        <button
          type="button"
          class="modal-button"
          :disabled="loading"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          v-if="step > 1"
          type="button"
          class="modal-button"
          :disabled="loading"
          @click="$emit('back')"
        >
          上一步
        </button>
        <button
          type="button"
          class="modal-button modal-button-primary"
          :disabled="!canConfirm || loading"
          @click="$emit('confirm')"
        >
          {{
            loading ? '处理中…' : stepType === 'confirm' ? '确认使用' : '下一步'
          }}
        </button>
      </div>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CHARACTER_CARDS } from '../types/cards-data'
import { CARD_CATALOG, getCatalogEntry } from '../types/card-catalog.generated'
import type { DeployedSlot, PlayerState } from '../types/game'
import AppDialog from './ui/AppDialog.vue'

type StepType =
  | 'selectAttacker'
  | 'selectTarget'
  | 'selectAlly'
  | 'confirm'
  | 'selectSlot'
  | 'selectReplacement'
  | 'chooseReplenishMode'
  | 'chooseRecoveryMode'
  | 'selectPlayerTarget'
  | 'selectEquipmentTarget'
  | 'selectStrategyTarget'
  | 'selectStrategyPlayer'
  | 'selectStrategyTarget1'
  | 'selectStrategyTarget2'
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
  excludedUid?: string | null
  selectedSlot?: number | null
  selectedName?: string
  selectedImage?: string
  selectedMode?: string | null
  confirmSummary: string
  myDeployed: DeployedSlot[]
  myPlayer?: PlayerState | null
  enemyPlayers: PlayerState[]
  loading?: boolean
}>()
defineEmits<{
  select: [uid: string, playerId?: string]
  selectMode: [mode: string]
  confirm: []
  cancel: []
  back: []
}>()

interface Choice {
  uid: string
  playerId?: string
  name: string
  image?: string
  hp: number
  maxHp: number
  attack?: number
  badge?: string
  disabled?: boolean
}
interface SelectionGroup {
  id: string
  label?: string
  choices: Choice[]
}
const faceByImage = new Map(CARD_CATALOG.map((card) => [card.imageFile, card]))
const previewImage = computed(
  () => faceByImage.get(props.cardImage)?.thumbnailFile ?? props.cardImage,
)
const selectedThumbnail = computed(
  () =>
    faceByImage.get(props.selectedImage ?? '')?.thumbnailFile ??
    props.selectedImage,
)
function getCharImg(cardId: string) {
  return (
    getCatalogEntry(cardId)?.thumbnailFile ??
    CHARACTER_CARDS.find((c) => c.id === cardId)?.thumbnailFile ??
    ''
  )
}
function getCharName(cardId: string) {
  return CHARACTER_CARDS.find((c) => c.id === cardId)?.name ?? cardId
}
function characterChoices(slots: DeployedSlot[], playerId?: string): Choice[] {
  return slots.flatMap((slot) => {
    const char = slot.character
    if (!char || char.state === 'retired') return []
    const cannotAct =
      char.state !== 'normal' ||
      char.debuffs.some(
        (debuff) => debuff.type === 'loseAbility' || debuff.type === 'disarm',
      )
    const unavailable =
      props.stepType === 'selectAttacker' && (!char.hasActionPoint || cannotAct)
    const untargetable =
      props.stepType === 'selectTarget' &&
      char.keywords.includes('untargetable')
    const equipped =
      props.stepType === 'selectEquipmentTarget' && !!slot.equipment
    const alreadySelected = props.excludedUid === char.uid
    return [
      {
        uid: char.uid,
        playerId,
        name: getCharName(char.cardId),
        image: getCharImg(char.cardId),
        hp: char.currentHp,
        maxHp: char.maxHp,
        attack: char.attack,
        disabled: unavailable || equipped || untargetable || alreadySelected,
        badge: alreadySelected
          ? '已选为第一名'
          : equipped
            ? '已有装备'
            : unavailable
              ? !char.hasActionPoint
                ? 'AP 已用'
                : '无法攻击'
              : untargetable
                ? '不可选中'
                : char.state === 'nearDeath'
                  ? '濒死'
                  : '',
      },
    ]
  })
}
function playerChoice(player: PlayerState): Choice {
  return {
    uid: player.id,
    playerId: player.id,
    name: player.isAi ? player.name : '你',
    hp: player.hp,
    maxHp: player.maxHp,
    badge: '玩家',
  }
}
const excludedTargetName = computed(() => {
  const slots = [
    ...props.myDeployed,
    ...props.enemyPlayers.flatMap((player) => player.deployed),
  ]
  const target = slots.find(
    (slot) => slot.character?.uid === props.excludedUid,
  )?.character
  return target ? getCharName(target.cardId) : '已选角色'
})

const selectionGroups = computed<SelectionGroup[]>(() => {
  const type = props.stepType
  if (
    [
      'selectAttacker',
      'selectAlly',
      'selectReplacement',
      'selectEquipmentTarget',
    ].includes(type)
  )
    return [{ id: 'ally', choices: characterChoices(props.myDeployed) }]
  if (type === 'selectPlayerTarget')
    return props.enemyPlayers.map((player) => ({
      id: player.id,
      choices: [playerChoice(player)],
    }))
  if (type === 'selectStrategyPlayer') {
    const players = props.myPlayer
      ? [props.myPlayer, ...props.enemyPlayers]
      : props.enemyPlayers
    return [
      {
        id: 'players',
        choices: players.filter((player) => player.isAlive).map(playerChoice),
      },
    ]
  }
  if (type === 'selectStrategyTarget1' || type === 'selectStrategyTarget2') {
    const groups: SelectionGroup[] = props.myPlayer?.isAlive
      ? [
          {
            id: 'ally',
            label: '你的角色',
            choices: characterChoices(props.myDeployed),
          },
        ]
      : []
    return groups.concat(
      props.enemyPlayers
        .filter((player) => player.isAlive)
        .map((player) => ({
          id: player.id,
          label: player.name,
          choices: characterChoices(player.deployed, player.id),
        })),
    )
  }
  if (type === 'selectTarget' || type === 'selectStrategyTarget') {
    const groups: SelectionGroup[] =
      type === 'selectStrategyTarget'
        ? [
            {
              id: 'ally',
              label: '己方角色',
              choices: characterChoices(props.myDeployed),
            },
          ]
        : []
    for (const player of props.enemyPlayers) {
      const choices = characterChoices(player.deployed, player.id)
      groups.push({
        id: player.id,
        label: player.name,
        choices: choices.length ? choices : [playerChoice(player)],
      })
    }
    return groups
  }
  return []
})
const modeOptions = computed(() => {
  if (props.stepType === 'chooseReplenishMode')
    return [
      { id: 'draw', name: '抽牌', description: '从牌堆抽取 2 张牌' },
      {
        id: 'recruit',
        name: '招揽角色',
        description: '从角色池招揽 1 张角色牌',
      },
    ]
  if (props.stepType === 'chooseRecoveryMode')
    return [
      { id: 'character', name: '回复角色', description: '回复己方角色的体力' },
      { id: 'player', name: '回复玩家', description: '回复玩家的体力值' },
    ]
  return []
})
const canConfirm = computed(() => {
  if (props.stepType === 'confirm') return true
  if (props.stepType === 'selectSlot')
    return (
      props.selectedSlot != null &&
      !props.myDeployed[props.selectedSlot]?.character
    )
  if (modeOptions.value.length)
    return modeOptions.value.some((mode) => mode.id === props.selectedMode)
  return selectionGroups.value.some((group) =>
    group.choices.some(
      (choice) => choice.uid === props.selectedUid && !choice.disabled,
    ),
  )
})
</script>

<style scoped>
.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}
.modal-card-preview {
  width: 88px;
  aspect-ratio: 110 / 156;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: 8px;
  flex: 0 0 auto;
}
.modal-card-info {
  min-width: 0;
}
.modal-card-type {
  display: inline-block;
  margin-bottom: 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 650;
}
.modal-card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}
.modal-card-stats {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}
.step-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}
.step-progress li {
  position: relative;
}
.step-progress li:not(:last-child)::after {
  position: absolute;
  top: 14px;
  left: 32px;
  width: 20px;
  height: 1px;
  content: '';
  background: var(--border);
}
.step-progress li > span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 650;
}
.step-progress .step-active > span {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent, #fff);
}
.step-progress .step-done > span {
  color: var(--success, #32744a);
}
.step-label {
  margin: 0 0 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
}
.target-list {
  display: grid;
  gap: 20px;
}
.target-note {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.65;
}
.target-group h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 650;
}
.select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 10px;
}
.select-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 80px;
  padding: 12px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.select-card:hover:not(:disabled),
.slot-opt:hover:not(:disabled),
.mode-card:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--accent);
}
.sel-selected,
.slot-sel,
.mode-selected {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 1px var(--accent);
}
.select-card:disabled,
.slot-opt:disabled,
.mode-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sel-img {
  width: 64px;
  height: 90px;
  border-radius: 4px;
  object-fit: contain;
}
.sel-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
}
.sel-info strong {
  color: var(--text);
  font-size: 12px;
}
.sel-hp {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.sel-badge {
  font-size: 10px;
  color: var(--warning, #8b5f19);
}
.sel-empty {
  margin: 16px 0;
  color: var(--text-dim);
  font-size: 13px;
  text-align: center;
}
.confirm-box {
  padding: 12px 0 20px;
  text-align: center;
}
.confirm-box > p {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.7;
}
.confirm-chip {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
}
.confirm-chip img {
  width: 36px;
  height: 50px;
  object-fit: contain;
  border-radius: 4px;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.mode-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 108px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.mode-card strong {
  font-size: 15px;
}
.mode-card > span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-dim);
}
.slot-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.slot-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 110px;
  padding: 8px 4px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}
.slot-opt strong {
  font-size: 22px;
  font-weight: 500;
}
.slot-opt span {
  font-size: 10px;
  overflow-wrap: anywhere;
}
.slot-opt img {
  width: 42px;
  max-width: 100%;
  height: 60px;
  object-fit: contain;
}
.slot-occupied {
  border-style: solid;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.modal-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.modal-button-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent, #fff);
}
.modal-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 390px) {
  .modal-header {
    gap: 12px;
  }
  .modal-card-preview {
    width: 68px;
  }
  .mode-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .slot-grid {
    gap: 4px;
  }
  .modal-button {
    padding: 10px 12px;
  }
  .select-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
