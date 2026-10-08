<script setup lang="ts">
interface Props {
  label?: string;
}

withDefaults(defineProps<Props>(), {
  label: 'Coba lagi',
});

const emit = defineEmits<{ retry: [] }>();

function onRetry() {
  emit('retry');
}
</script>

<template>
  <button
    type="button"
    class="rc-retry-action"
    @click="onRetry"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.rc-retry-action {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.rc-retry-action:hover {
  background: var(--ui-bg-muted, #f3f4f6);
}
.rc-retry-action:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>