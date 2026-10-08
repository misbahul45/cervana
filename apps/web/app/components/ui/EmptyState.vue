<script setup lang="ts">
interface Props {
  title?: string;
  message?: string;
  iconName?: string;
  ctaLabel?: string;
  ctaTo?: string;
}

defineProps<Props>();
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="rc-empty-state"
  >
    <div v-if="iconName" class="rc-empty-state__icon" aria-hidden="true">
      <UIcon :name="iconName" class="text-4xl opacity-60" />
    </div>
    <h2 v-if="title" class="rc-empty-state__title">{{ title }}</h2>
    <p v-if="message" class="rc-empty-state__message">{{ message }}</p>
    <NuxtLink
      v-if="ctaLabel && ctaTo"
      :to="ctaTo"
      class="rc-empty-state__cta"
    >
      {{ ctaLabel }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.rc-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  gap: 0.75rem;
  border: 1px dashed var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 1rem;
  background: var(--ui-bg-elevated, transparent);
}
.rc-empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
}
.rc-empty-state__message {
  color: var(--ui-text-muted);
  max-width: 32rem;
}
.rc-empty-state__cta {
  margin-top: 0.5rem;
}
</style>