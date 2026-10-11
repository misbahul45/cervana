<script setup lang="ts">
interface Props {
  title?: string;
  message?: string;
  details?: string;
  retryLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Terjadi kesalahan',
  message: 'Mohon coba lagi.',
  retryLabel: 'Coba lagi',
});

const emit = defineEmits<{ retry: [] }>();

function onRetry() {
  emit('retry');
}
</script>

<template>
  <div
    role="alert"
    aria-live="assertive"
    class="rc-error-state"
  >
    <UIcon name="i-lucide-alert-triangle" class="text-3xl text-red-500" aria-hidden="true" />
    <h2 class="rc-error-state__title">{{ title }}</h2>
    <p v-if="message" class="rc-error-state__message">{{ message }}</p>
    <p v-if="details" class="rc-error-state__details">{{ details }}</p>
    <button
      type="button"
      class="rc-error-state__retry"
      @click="onRetry"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>

<style scoped>
.rc-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem 1.5rem;
  border: 2px solid var(--rc-danger);
  border-radius: var(--rc-radius, 16px);
  background-color: color-mix(in srgb, var(--rc-danger) 8%, var(--rc-surface));
  text-align: center;
}
.rc-error-state :deep(.iconify),
.rc-error-state :deep(svg) {
  color: var(--rc-danger);
}
.rc-error-state__title {
  margin: 0;
  font-size: 1.1875rem;
  font-weight: 800;
}
.rc-error-state__message {
  max-width: 32rem;
  margin: 0;
  color: var(--rc-fg);
}
.rc-error-state__details {
  max-width: 32rem;
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.875rem;
}
.rc-error-state__retry {
  min-height: 3rem;
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--rc-primary-depth);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-primary);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-primary-depth);
  color: var(--rc-primary-fg);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.rc-error-state__retry:active {
  transform: translateY(var(--rc-depth, 4px));
  box-shadow: none;
}
.rc-error-state__retry:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 3px;
}
</style>
