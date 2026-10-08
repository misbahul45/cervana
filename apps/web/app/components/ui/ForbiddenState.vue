<script setup lang="ts">
interface Props {
  title?: string;
  message?: string;
  reason?: 'role' | 'tenant' | 'capability' | 'unauthenticated';
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Akses ditolak',
});

const reasonCopy: Record<NonNullable<Props['reason']>, string> = {
  role: 'Halaman ini membutuhkan peran tertentu untuk melanjutkan.',
  tenant: 'Halaman ini hanya tersedia untuk anggota ruang belajar ini.',
  capability: 'Anda tidak memiliki kemampuan yang dibutuhkan untuk halaman ini.',
  unauthenticated: 'Silakan masuk untuk melanjutkan.',
};

const visibleMessage = computed(() => props.message ?? reasonCopy[props.reason ?? 'role']);
</script>

<template>
  <div
    role="alert"
    aria-live="polite"
    class="rc-forbidden-state"
  >
    <UIcon name="i-lucide-shield-off" class="text-3xl text-amber-500" aria-hidden="true" />
    <h2 class="rc-forbidden-state__title">{{ title }}</h2>
    <p class="rc-forbidden-state__message">{{ visibleMessage }}</p>
    <NuxtLink to="/" class="rc-forbidden-state__cta">
      Kembali ke beranda
    </NuxtLink>
  </div>
</template>

<style scoped>
.rc-forbidden-state {
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
.rc-forbidden-state__title {
  font-size: 1.125rem;
  font-weight: 600;
}
.rc-forbidden-state__message {
  color: var(--ui-text);
  max-width: 32rem;
}
.rc-forbidden-state__cta {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
}
</style>