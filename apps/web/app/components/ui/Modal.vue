<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

const modelValue = defineModel<boolean>({ default: false });
const emit = defineEmits<{ close: [] }>();

function close() {
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

watch(
  modelValue,
  (open) => {
    if (!import.meta.client) return;
    if (open) window.addEventListener('keydown', onKeydown);
    else window.removeEventListener('keydown', onKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="close">
    <div class="modal-content" :class="$attrs.class" role="dialog" aria-modal="true">
      <button type="button" class="modal-close" aria-label="Tutup" @click="close">×</button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: rgb(0 0 0 / 0.55);
}
.modal-content {
  position: relative;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  padding: 1.5rem;
  overflow-y: auto;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-border);
  color: var(--rc-fg);
}
.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 1rem;
  border: 0;
  background: transparent;
  color: var(--rc-muted);
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
}
.modal-close:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 2px;
}
</style>
