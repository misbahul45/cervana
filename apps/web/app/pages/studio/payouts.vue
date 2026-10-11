<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { payoutApi, walletApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatAmount, formatDate } from '~/lib/format';

definePageMeta({
  title: 'Pencairan — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] },
  layout: 'studio',
});

useHead({ title: 'Pencairan — ReduCera Studio' });

const { data: overview, status, error, refresh } = useAsyncData(
  'studio:payouts',
  async () => {
    const [payouts, wallet] = await Promise.all([payoutApi.list(), walletApi.me()]);
    return { payouts, wallet };
  },
  { lazy: true },
);

const amount = ref<number | null>(null);
const bankName = ref('');
const accountNumber = ref('');
const accountName = ref('');
const requesting = ref(false);
const requestError = ref<string | null>(null);
const requested = ref(false);
const idempotency = useIdempotencyKey();

async function request() {
  if (requesting.value) return;
  if (!amount.value || amount.value <= 0) {
    requestError.value = 'Masukkan jumlah pencairan.';
    return;
  }
  requesting.value = true;
  requestError.value = null;
  requested.value = false;
  try {
    await payoutApi.request(
      {
        amount: amount.value,
        destination: {
          bankName: bankName.value.trim(),
          accountNumber: accountNumber.value.trim(),
          accountName: accountName.value.trim(),
        },
      },
      idempotency.current(),
    );
    idempotency.reset();
    amount.value = null;
    requested.value = true;
    await refresh();
  } catch (err) {
    requestError.value = describeApiError(err, 'Pencairan gagal diajukan. Coba lagi.');
  } finally {
    requesting.value = false;
  }
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pencairan" subtitle="Ajukan pencairan saldo ke rekeningmu. Admin meninjau lalu mentransfer." />

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !overview" title="Gagal memuat pencairan" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <ul class="rc-studio-stats" aria-label="Saldo">
        <li class="rc-card">
          <span class="rc-hint">Saldo yang dapat dicairkan</span>
          <strong>{{ overview.wallet ? formatAmount(overview.wallet.balance, overview.wallet.currency) : formatAmount(0) }}</strong>
        </li>
      </ul>

      <PlayCard as="section" aria-labelledby="request-h">
        <h2 id="request-h" class="rc-h2">Ajukan pencairan</h2>
        <form class="rc-studio-form" novalidate @submit.prevent="request">
          <div class="rc-studio-form__row">
            <label class="rc-label">
              Jumlah (Rp)
              <input v-model.number="amount" class="rc-field" type="number" min="1" step="1" required />
            </label>
            <label class="rc-label">
              Bank
              <input v-model="bankName" class="rc-field" type="text" minlength="2" maxlength="80" required />
            </label>
            <label class="rc-label">
              Nomor rekening
              <input v-model="accountNumber" class="rc-field" type="text" inputmode="numeric" minlength="3" maxlength="40" required />
            </label>
            <label class="rc-label">
              Nama pemilik rekening
              <input v-model="accountName" class="rc-field" type="text" minlength="2" maxlength="120" required />
            </label>
          </div>
          <p v-if="requested" class="rc-alert rc-alert--success" role="status">Pengajuan pencairan diterima dan menunggu peninjauan.</p>
          <p v-if="requestError" class="rc-alert rc-alert--error" role="alert">{{ requestError }}</p>
          <div class="rc-actions">
            <PlayButton type="submit" :loading="requesting">Ajukan pencairan</PlayButton>
          </div>
        </form>
      </PlayCard>

      <section aria-labelledby="history-h">
        <h2 id="history-h" class="rc-h2">Riwayat pencairan</h2>
        <ul v-if="overview.payouts.length" class="rc-studio-list" aria-label="Riwayat pencairan">
          <li v-for="payout in overview.payouts" :key="payout.id" class="rc-card">
            <div class="rc-studio-list__main">
              <p class="rc-studio-list__title">{{ formatAmount(payout.amount) }}</p>
              <p class="rc-hint">
                {{ formatDate(payout.requestedAt) }}<template v-if="payout.destinationInfo"> · {{ payout.destinationInfo.bankName }} {{ payout.destinationInfo.accountNumber }}</template>
              </p>
              <p v-if="payout.status === 'REJECTED' && payout.rejectionReason" class="rc-error-text">Catatan: {{ payout.rejectionReason }}</p>
            </div>
            <StatusBadge :tone="statusMeta('payout', payout.status).tone" :label="statusMeta('payout', payout.status).label" />
          </li>
        </ul>
        <EmptyState v-else title="Belum ada pencairan" message="Pencairan akan muncul di sini setelah kamu mengajukannya." />
      </section>
    </template>
  </div>
</template>
