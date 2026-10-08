<script setup lang="ts">
import { ref } from 'vue';

definePageMeta({
  title: 'Sandbox Akuntansi — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const accountCatalog = {
  '1000': { type: 'Kas', normalBalance: 'DEBIT' as const },
  '1010': { type: 'Bank', normalBalance: 'DEBIT' as const },
  '1100': { type: 'Piutang Dagang', normalBalance: 'DEBIT' as const },
  '1200': { type: 'Persediaan', normalBalance: 'DEBIT' as const },
  '2000': { type: 'Utang Dagang', normalBalance: 'CREDIT' as const },
  '2100': { type: 'Utang Gaji', normalBalance: 'CREDIT' as const },
  '3000': { type: 'Modal', normalBalance: 'CREDIT' as const },
  '4000': { type: 'Pendapatan Jasa', normalBalance: 'CREDIT' as const },
  '5000': { type: 'Beban Gaji', normalBalance: 'DEBIT' as const },
  '5100': { type: 'Beban Sewa', normalBalance: 'DEBIT' as const },
};

const scenario = ref({
  title: 'Beli peralatan Rp 5.000.000 tunai',
  description: 'Catat pembelian peralatan kantor secara tunai sebesar Rp 5.000.000 dari kas.',
  objective: 'Menerapkan double-entry pada pembelian aset tetap.',
  estimatedMinutes: 8,
});

const posting = ref<{ status: 'idle' | 'pending' | 'success' | 'error'; message?: string }>({
  status: 'idle',
});

function onSubmit(_lines: unknown[]) {
  posting.value = { status: 'pending' };
  setTimeout(() => {
    posting.value = {
      status: 'success',
      message: 'Jurnal tercatat. Coba validasi di Trial Balance.',
    };
  }, 800);
}
</script>

<template>
  <main id="main" aria-labelledby="sandbox-heading">
    <header class="rc-sandbox-attempt__header">
      <p class="rc-sandbox-attempt__eyebrow">Sandbox Akuntansi</p>
      <h1 id="sandbox-heading">{{ scenario.title }}</h1>
      <p class="rc-sandbox-attempt__objective">
        <strong>Tujuan:</strong> {{ scenario.objective }}
      </p>
      <p class="rc-sandbox-attempt__description">{{ scenario.description }}</p>
      <p class="rc-sandbox-attempt__estimate">Perkiraan waktu: {{ scenario.estimatedMinutes }} menit</p>
    </header>

    <JournalEntryGrid
      :account-catalog="accountCatalog"
      :period-open="true"
      @submit="onSubmit"
    />

    <div v-if="posting.status === 'success'" class="rc-sandbox-attempt__posting-success" role="status">
      {{ posting.message }}
    </div>
    <LoadingSkeleton v-else-if="posting.status === 'pending'" variant="inline" />

    <nav class="rc-sandbox-attempt__next" aria-label="Aksi setelahnya">
      <NuxtLink to="/sandbox">← Kembali ke daftar skenario</NuxtLink>
      <NuxtLink to="/learn/profile/dashboard">Lanjut ke dashboard</NuxtLink>
    </nav>
  </main>
</template>

<style scoped>
.rc-sandbox-attempt__header { margin-bottom: 1rem; }
.rc-sandbox-attempt__eyebrow {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rc-sandbox-attempt__header h1 { font-size: 1.5rem; font-weight: 700; }
.rc-sandbox-attempt__objective { color: var(--ui-text); margin: 0.5rem 0; }
.rc-sandbox-attempt__description { color: var(--ui-text-muted); }
.rc-sandbox-attempt__estimate {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-sandbox-attempt__posting-success {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #dcfce7;
  color: #166534;
}
.rc-sandbox-attempt__next {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
</style>