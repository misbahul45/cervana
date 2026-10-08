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
  text-align: center;
  padding: 2.5rem 1.5rem;
  gap: 0.75rem;
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 1rem;
  background: rgba(254, 226, 226, 0.4);
}
.rc-error-state__title {
  font-size: 1.125rem;
  font-weight: 600;
}
.rc-error-state__message {
  color: var(--ui-text);
  max-width: 32rem;
}
.rc-error-state__details {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  max-width: 32rem;
}
.rc-error-state__retry {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
}
.rc-error-state__retry:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>