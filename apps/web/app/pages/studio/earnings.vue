<script setup lang="ts">
import { earningsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate, formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Pendapatan Kreator — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'studio',
});

const { data: earnings, status, error, refresh } = useAsyncData(
  'studio:earnings',
  async () => {
    const [summary, history] = await Promise.all([earningsApi.me(), earningsApi.history()]);
    return { summary, history };
  },
  { lazy: true },
);
</script>

<template>
  <main id="main" aria-labelledby="earnings-heading">
    <header>
      <h1 id="earnings-heading">Pendapatan</h1>
      <p>Pendapatan yang sudah dirilis, pendapatan yang masih ditahan, dan riwayatnya.</p>
    </header>

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="error || !earnings"
      title="Gagal memuat pendapatan"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <template v-else>
      <section class="rc-earnings__balance" aria-label="Saldo">
        <div>
          <h2>Sudah dirilis</h2>
          <p class="rc-earnings__amount">{{ formatMoney(earnings.summary.available, earnings.summary.currency) }}</p>
        </div>
        <div>
          <h2>Masih ditahan</h2>
          <p>{{ formatMoney(earnings.summary.pending, earnings.summary.currency) }}</p>
        </div>
      </section>

      <section aria-labelledby="ledger-h">
        <h2 id="ledger-h">Riwayat</h2>
        <EmptyState
          v-if="earnings.history.length === 0"
          title="Belum ada pendapatan"
          message="Pendapatan dari penjualan artikel dan kelas akan muncul di sini."
        />
        <table v-else class="rc-earnings__ledger">
          <thead>
            <tr><th>Tanggal</th><th>Status</th><th>Jumlah</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in earnings.history" :key="row.id">
              <td>{{ formatDate(row.createdAt) }}</td>
              <td>{{ row.releasedAt ? 'Dirilis' : 'Ditahan' }}</td>
              <td>{{ formatMoney(row.creatorAmount, row.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <NuxtLink to="/studio/payouts" class="rc-earnings__cta">Lihat pencairan</NuxtLink>
    </template>
  </main>
</template>

<style scoped>
.rc-earnings__balance {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
  margin: 1rem 0;
}
.rc-earnings__amount {
  font-size: 1.5rem;
  font-weight: 700;
}
.rc-earnings__hold {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-earnings__ledger {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}
.rc-earnings__ledger th,
.rc-earnings__ledger td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
}
.rc-earnings__cta {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.625rem 1.25rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border-radius: 0.5rem;
  font-weight: 600;
}
</style>