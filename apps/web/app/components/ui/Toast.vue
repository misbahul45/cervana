<script setup lang="ts">
defineProps<{
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div :class="['toast', `toast-${type || 'info'}`]" role="status">
    <span class="toast-message">{{ message }}</span>
    <button type="button" class="toast-close" @click="emit('close')" aria-label="Close">×</button>
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-left: 4px solid;
}
.toast-info { background: var(--rc-bg-elevated, #dbeafe); border-color: var(--rc-primary, #3b82f6); color: var(--rc-fg, #111); }
.toast-success { background: #dcfce7; border-color: var(--rc-success, #16a34a); color: var(--rc-fg, #111); }
.toast-warning { background: #fef3c7; border-color: #f59e0b; color: var(--rc-fg, #111); }
.toast-error { background: #fee2e2; border-color: var(--rc-danger, #dc2626); color: var(--rc-fg, #111); }
.toast-message { flex: 1; }
.toast-close { background: transparent; border: none; font-size: 1.25rem; cursor: pointer; color: inherit; opacity: 0.6; }
.toast-close:hover { opacity: 1; }
</style>