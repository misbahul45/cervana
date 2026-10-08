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
              class="rc-confirm-dialog__cancel"
              @click="onCancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              :class="['rc-confirm-dialog__confirm', destructive ? 'rc-confirm-dialog__confirm--destructive' : '']"
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.rc-confirm-dialog {
  background: var(--ui-bg, white);
  border-radius: 1rem;
  padding: 1.5rem;
  max-width: 32rem;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.rc-confirm-dialog__title {
  font-size: 1.125rem;
  font-weight: 600;
}
.rc-confirm-dialog__message {
  color: var(--ui-text-muted);
}
.rc-confirm-dialog__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
.rc-confirm-dialog__cancel,
.rc-confirm-dialog__confirm {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
}
.rc-confirm-dialog__confirm {
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border-color: var(--ui-primary, #2563eb);
}
.rc-confirm-dialog__confirm--destructive {
  background: #dc2626;
  border-color: #dc2626;
}
.rc-confirm-dialog__cancel:focus-visible,
.rc-confirm-dialog__confirm:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>