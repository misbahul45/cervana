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
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  border: 2px dashed var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-foam);
  text-align: center;
}
.rc-empty-state__icon {
  color: var(--rc-muted);
}
.rc-empty-state__title {
  margin: 0;
  font-size: 1.1875rem;
  font-weight: 800;
}
.rc-empty-state__message {
  max-width: 32rem;
  margin: 0;
  color: var(--rc-muted);
}
.rc-empty-state__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--rc-primary-depth);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-primary);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-primary-depth);
  color: var(--rc-primary-fg);
  font-size: 0.9375rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
}
.rc-empty-state__cta:active {
  transform: translateY(var(--rc-depth, 4px));
  box-shadow: none;
}
.rc-empty-state__cta:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 3px;
}
</style>
