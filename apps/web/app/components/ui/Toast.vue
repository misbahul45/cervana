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
  max-width: 24rem;
  padding: 0.875rem 1rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-border);
  color: var(--rc-fg);
}
.rc-toast--success { border-color: var(--rc-success); box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-success); }
.rc-toast--error { border-color: var(--rc-danger); box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-danger); }
.rc-toast--warning { border-color: var(--rc-warning); box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-warning); }
.rc-toast--info { border-color: var(--rc-info); box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-info); }
.rc-toast__icon { font-size: 1.375rem; }
.rc-toast__icon--success { color: var(--rc-primary); }
.rc-toast__icon--error { color: var(--rc-danger); }
.rc-toast__icon--warning { color: var(--rc-accent); }
.rc-toast__icon--info { color: var(--rc-secondary); }
.rc-toast__body {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.rc-toast__title { font-weight: 800; }
.rc-toast__message { margin: 0.125rem 0 0; color: var(--rc-muted); font-size: 0.875rem; }
.rc-toast__dismiss {
  border: 0;
  background: transparent;
  color: var(--rc-muted);
  font-size: 1.375rem;
  line-height: 1;
  cursor: pointer;
}
.rc-toast__dismiss:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 2px;
}
</style>
