<script setup lang="ts">
type State = 'idle' | 'typing' | 'streaming' | 'completed' | 'error' | 'timeout' | 'insufficient-credit' | 'no-grounding';

interface Props {
  state: State;
  errorMessage?: string;
}

defineProps<Props>();

const STATE_LABEL: Record<State, string> = {
  'idle': 'Siap',
  'typing': 'Mengetik',
  'streaming': 'Menjawab...',
  'completed': 'Selesai',
  'error': 'Terjadi kesalahan',
  'timeout': 'Waktu habis',
  'insufficient-credit': 'Saldo kredit tidak cukup',
  'no-grounding': 'Materi tidak ditemukan',
};

const STATE_TONE: Record<State, 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
  'idle': 'neutral',
  'typing': 'info',
  'streaming': 'info',
  'completed': 'success',
  'error': 'error',
  'timeout': 'warning',
  'insufficient-credit': 'warning',
  'no-grounding': 'warning',
};
</script>

<template>
  <div class="rc-tutor-status" role="status" aria-live="polite">
    <UIcon
      :name="
        state === 'idle' ? 'i-lucide-circle' :
        state === 'typing' ? 'i-lucide-edit' :
        state === 'streaming' ? 'i-lucide-loader' :
        state === 'completed' ? 'i-lucide-check' :
        state === 'error' ? 'i-lucide-alert-circle' :
        state === 'timeout' ? 'i-lucide-clock-alert' :
        state === 'insufficient-credit' ? 'i-lucide-wallet' :
        'i-lucide-search-x'
      "
      :class="`rc-tutor-status__icon rc-tutor-status__icon--${state}`"
      aria-hidden="true"
    />
    <div>
      <strong>{{ STATE_LABEL[state] }}</strong>
      <p v-if="errorMessage">{{ errorMessage }}</p>
      <StatusBadge :tone="STATE_TONE[state]">{{ state }}</StatusBadge>
    </div>
  </div>
</template>

<style scoped>
.rc-tutor-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: var(--ui-bg-elevated, transparent);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-tutor-status__icon { font-size: 1.5rem; }
.rc-tutor-status__icon--streaming { animation: rc-spin 1s linear infinite; }
.rc-tutor-status__icon--error { color: #dc2626; }
.rc-tutor-status__icon--timeout,
.rc-tutor-status__icon--insufficient-credit,
.rc-tutor-status__icon--no-grounding { color: #d97706; }
.rc-tutor-status__icon--completed { color: #16a34a; }
@keyframes rc-spin {
  100% { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .rc-tutor-status__icon--streaming { animation: none; }
}
</style>