<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Pencairan Admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

const { data: payouts, isLoading, error } = useQuery({
  queryKey: QK.admin.payouts(),
  queryFn: async () => ([
    { id: 'po-1', creatorLabel: 'maya-sari', amountLabel: 'Rp 1.000.000', status: 'APPROVED' as const, requestedAt: '2026-09-25' },
    { id: 'po-2', creatorLabel: 'andi-p', amountLabel: 'Rp 750.000', status: 'PAID' as const, requestedAt: '2026-08-15' },
    { id: 'po-3', creatorLabel: 'tim-redaucera', amountLabel: 'Rp 500.000', status: 'PENDING_REVIEW' as const, requestedAt: '2026-09-30' },
  ]),
  staleTime: 30_000,
});

const STATUS_TONE: Record<string, 'info' | 'success' | 'warning' | 'error' | 'neutral'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  REJECTED: 'error',
};
</script>

<template>
  <main id="main" aria-labelledby="po-h">
    <PreviewNotice />
    <h1 id="po-h">Pencairan</h1>

    <LoadingSkeleton v-if="isLoading" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat pencairan" />
    <table v-else-if="payouts && payouts.length" class="rc-admin-payouts__table">
      <thead>
        <tr><th>Kreator</th><th>Jumlah</th><th>Status</th><th>Tanggal</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in payouts" :key="p.id">
          <td>{{ p.creatorLabel }}</td>
          <td>{{ p.amountLabel }}</td>
          <td>
            <StatusBadge :tone="STATUS_TONE[p.status] || 'neutral'">{{ p.status }}</StatusBadge>
          </td>
          <td>{{ p.requestedAt }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.rc-admin-payouts__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.rc-admin-payouts__table th,
.rc-admin-payouts__table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
}
</style>