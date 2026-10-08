<script setup lang="ts">
interface Props {
  cost: number;
  actionLabel?: string;
  warning?: string;
}

const props = withDefaults(defineProps<Props>(), {
  actionLabel: 'Lanjutkan',
  warning: 'Pertanyaan ini memakai {n} kredit AI. Pastikan saldo Anda cukup.',
});

const formattedWarning = computed(() => props.warning.replace('{n}', String(props.cost)));
</script>

<template>
  <div
    role="alert"
    aria-live="polite"
    class="rc-insufficient-credits"
  >
    <UIcon name="i-lucide-wallet" class="text-3xl text-amber-500" aria-hidden="true" />
    <h2 class="rc-insufficient-credits__title">Saldo kredit tidak cukup</h2>
    <p class="rc-insufficient-credits__message">{{ formattedWarning }}</p>
    <p class="rc-insufficient-credits__hint">
      Isi ulang kredit Anda atau selesaikan aktivitas belajar yang lebih ringan terlebih dahulu.
    </p>
    <NuxtLink to="/credits" class="rc-insufficient-credits__cta">
      Isi ulang kredit
    </NuxtLink>
  </div>
</template>

<style scoped>
.rc-insufficient-credits {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  gap: 0.75rem;
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 1rem;
  background: rgba(254, 243, 199, 0.4);
}
.rc-insufficient-credits__title {
  font-size: 1.125rem;
  font-weight: 600;
}
.rc-insufficient-credits__message {
  color: var(--ui-text);
  max-width: 32rem;
}
.rc-insufficient-credits__hint {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  max-width: 32rem;
}
.rc-insufficient-credits__cta {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
}
</style>