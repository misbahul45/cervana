<script setup lang="ts">
defineProps<{ title: string; description?: string; primary?: boolean }>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" :class="['rc-btn', primary ? '' : 'rc-btn--outline']" @click="emit('click')">
    <span class="rc-action__label">
      {{ title }}
      <span v-if="description" class="rc-action__desc">{{ description }}</span>
    </span>
  </button>
</template>

<style scoped>
.rc-action__label {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.rc-action__desc {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.85;
}
</style>
