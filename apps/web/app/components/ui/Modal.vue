<script setup lang="ts">
const modelValue = defineModel<boolean>({ default: false });
defineEmits<{ close: [] }>();
</script>

<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content" :class="$attrs.class" role="dialog" aria-modal="true">
      <button type="button" class="modal-close" @click="emit('close')" aria-label="Close">×</button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal-content {
  background: var(--rc-bg, #fff);
  color: var(--rc-fg, #111);
  border-radius: 0.75rem;
  padding: 1.5rem;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 1rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--rc-fg-muted, #6b7280);
  line-height: 1;
}
</style>