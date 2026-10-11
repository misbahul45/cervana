<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { earningsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatAmount, formatDate } from '~/lib/format';

definePageMeta({
  title: 'Pendapatan — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Pendapatan — ReduCera Studio' });

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
  <div class="rc-stack">
    <PageHeader title="Pendapatan" subtitle="Pendapatan yang sudah dirilis, yang masih ditahan, dan riwayatnya.">
      <template #actions>
        <PlayButton to="/studio/payouts" size="sm">Pencairan</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !earnings" title="Gagal memuat pendapatan" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <ul class="rc-studio-stats" aria-label="Saldo pendapatan">
        <li class="rc-card"><span class="rc-hint">Sudah dirilis</span><strong>{{ formatAmount(earnings.summary.available, earnings.summary.currency) }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Masih ditahan</span><strong>{{ formatAmount(earnings.summary.pending, earnings.summary.currency) }}</strong></li>
      </ul>

      <section aria-labelledby="ledger-h">
        <h2 id="ledger-h" class="rc-h2">Riwayat</h2>
        <EmptyState
          v-if="earnings.history.length === 0"
          title="Belum ada pendapatan"
          message="Pendapatan dari penjualan artikel dan kelas akan muncul di sini."
        />
        <div v-else class="rc-table-wrap">
          <table class="rc-table">
            <caption>Riwayat pendapatan</caption>
            <thead>
              <tr>
                <th scope="col">Tanggal</th>
                <th scope="col">Status</th>
                <th scope="col" class="rc-table__num">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in earnings.history" :key="row.id">
                <td>{{ formatDate(row.createdAt) }}</td>
                <td>{{ row.releasedAt ? 'Dirilis' : 'Ditahan' }}</td>
                <td class="rc-table__num">{{ formatAmount(row.creatorAmount, row.currency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
