<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    description?: string
    wide?: boolean
  }>(),
  { description: '', wide: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const returnFocus = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open && typeof document !== 'undefined')
      returnFocus.value =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
  },
  { immediate: true, flush: 'sync' },
)

function restoreFocus(event: Event) {
  if (!returnFocus.value?.isConnected) return
  event.preventDefault()
  returnFocus.value.focus({ preventScroll: true })
}
</script>

<template>
  <DialogRoot
    :open="modelValue"
    @update:open="emit('update:modelValue', $event)"
  >
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="app-dialog"
        :class="{ 'app-dialog-wide': wide }"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        @close-auto-focus="restoreFocus"
      >
        <header class="dialog-heading">
          <div>
            <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="dialog-description">{{
              description
            }}</DialogDescription>
          </div>
          <DialogClose class="icon-button dialog-close" aria-label="关闭对话框"
            ><X :size="20" aria-hidden="true"
          /></DialogClose>
        </header>
        <div class="dialog-body"><slot /></div>
        <footer v-if="$slots.footer" class="dialog-footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: rgb(30 27 23 / 45%);
  animation: dialog-overlay-in 140ms ease-out;
}
.app-dialog {
  position: fixed;
  z-index: calc(var(--z-modal) + 1);
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(600px, calc(100vw - 32px));
  max-height: min(90svh, 960px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
  overflow: hidden;
  outline: none;
}
.app-dialog-wide {
  width: min(1000px, calc(100vw - 48px));
}
.dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 28px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dialog-title {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  line-height: 1.4;
}
.dialog-description {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--text-dim);
}
.dialog-close {
  flex-shrink: 0;
  margin: -4px -8px -4px 0;
  border-color: transparent;
}
.dialog-body {
  padding: 24px 28px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 18px 28px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
@keyframes dialog-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (max-width: 600px) {
  .app-dialog,
  .app-dialog-wide {
    width: calc(100vw - 24px);
    max-height: 92svh;
  }
  .dialog-heading {
    padding: 18px 20px 16px;
    gap: 12px;
  }
  .dialog-title {
    font-size: 20px;
  }
  .dialog-body {
    padding: 20px;
  }
  .dialog-footer {
    padding: 16px 20px;
  }
}
</style>
