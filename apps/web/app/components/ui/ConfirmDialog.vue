<script setup lang="ts">
interface Props {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Konfirmasi',
  confirmLabel: 'Lanjutkan',
  cancelLabel: 'Batal',
  destructive: false,
});

const emit = defineEmits<{ confirm: []; cancel: [] }>();

function onConfirm() {
  emit('confirm');
}
function onCancel() {
  emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="rc-dialog">
      <div
        v-if="open"
        class="rc-confirm-dialog-backdrop"
        @click.self="onCancel"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`rc-confirm-dialog-title-${title}`"
          class="rc-confirm-dialog"
        >
          <h2 :id="`rc-confirm-dialog-title-${title}`" class="rc-confirm-dialog__title">{{ title }}</h2>
          <p v-if="message" class="rc-confirm-dialog__message">{{ message }}</p>
          <div class="rc-confirm-dialog__actions">
            <button
              type="button"
              class="rc-btn rc-btn--outline rc-btn--sm"
              @click="onCancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              :class="['rc-btn', 'rc-btn--sm', destructive ? 'rc-btn--danger' : '']"
              @click="onConfirm"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.rc-confirm-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: rgb(0 0 0 / 0.55);
}
.rc-confirm-dialog {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 32rem;
  padding: 1.5rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-border);
  color: var(--rc-fg);
}
.rc-confirm-dialog__title {
  margin: 0;
  font-size: 1.1875rem;
  font-weight: 800;
}
.rc-confirm-dialog__message {
  margin: 0;
  color: var(--rc-muted);
}
.rc-confirm-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}
.rc-dialog-enter-active,
.rc-dialog-leave-active {
  transition: opacity 150ms ease-out;
}
.rc-dialog-enter-from,
.rc-dialog-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .rc-dialog-enter-active,
  .rc-dialog-leave-active {
    transition: none;
  }
}
</style>
