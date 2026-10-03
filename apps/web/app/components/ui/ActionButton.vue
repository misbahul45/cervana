<script setup lang="ts">
defineProps<{ title: string; description?: string; primary?: boolean }>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    @click="emit('click')"
    :class="[
      'btn',
      primary ? 'btn-primary' : 'btn-secondary',
    ]"
  >
    {{ title }}
    <span v-if="description" class="btn-desc">{{ description }}</span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.875rem;
}
.btn-primary { background: var(--rc-primary, #3b82f6); color: white; }
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
.btn-secondary { background: var(--rc-bg-elevated, #f3f4f6); color: var(--rc-fg, #111); border: 1px solid var(--rc-border, #d1d5db); }
.btn-secondary:hover { background: var(--rc-bg, #fff); }
.btn-desc { font-size: 0.75rem; opacity: 0.8; font-weight: 400; }
</style>