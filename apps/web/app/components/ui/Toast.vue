<script setup lang="ts">
import { useToast } from '#imports';

interface Props {
  title: string;
  message?: string;
  tone?: 'success' | 'warning' | 'error' | 'info';
  durationMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'info',
  durationMs: 4000,
});

const emit = defineEmits<{ dismiss: [] }>();

function dismiss() {
  emit('dismiss');
}
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="['rc-toast', `rc-toast--${tone}`]"
  >
    <UIcon
      :name="tone === 'success' ? 'i-lucide-check-circle' : tone === 'error' ? 'i-lucide-alert-circle' : tone === 'warning' ? 'i-lucide-alert-triangle' : 'i-lucide-info'"
      :class="`rc-toast__icon rc-toast__icon--${tone}`"
      aria-hidden="true"
    />
    <div class="rc-toast__body">
      <strong class="rc-toast__title">{{ title }}</strong>
      <p v-if="message" class="rc-toast__message">{{ message }}</p>
    </div>
    <button
      type="button"
      class="rc-toast__dismiss"
      aria-label="Tutup notifikasi"
      @click="dismiss"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.rc-toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  max-width: 24rem;
}
.rc-toast__icon { font-size: 1.25rem; }
.rc-toast__icon--success { color: #16a34a; }
.rc-toast__icon--error   { color: #dc2626; }
.rc-toast__icon--warning { color: #d97706; }
.rc-toast__icon--info    { color: #2563eb; }
.rc-toast__body {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.rc-toast__title { font-weight: 600; }
.rc-toast__message { font-size: 0.875rem; color: var(--ui-text-muted); }
.rc-toast__dismiss {
  background: transparent;
  border: 0;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--ui-text-muted);
}
.rc-toast__dismiss:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>