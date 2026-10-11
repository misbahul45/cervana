<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <header class="rc-pageheader">
    <div class="rc-pageheader__text">
      <h1 class="rc-pageheader__title">{{ title }}</h1>
      <p v-if="subtitle" class="rc-pageheader__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="rc-pageheader__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style>
.rc-pageheader {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.rc-pageheader__title {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
}

.rc-pageheader__subtitle {
  margin: 0.5rem 0 0;
  max-width: 40rem;
  color: var(--rc-muted);
}

.rc-pageheader__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
