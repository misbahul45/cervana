<script setup lang="ts">
import { payoutApi, walletApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate, formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Pencairan — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] },
  layout: 'studio',
});

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

const STATUS_META: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  REQUESTED: { label: 'Diajukan', tone: 'warning' },
  UNDER_REVIEW: { label: 'Ditinjau', tone: 'info' },
  APPROVED: { label: 'Disetujui', tone: 'info' },
  PAID: { label: 'Dibayar', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'error' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
};

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
  <main id="main" aria-labelledby="payouts-h">
    <h1 id="payouts-h">Pencairan</h1>

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="error || !overview"
      title="Gagal memuat pencairan"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <template v-else>
      <p v-if="overview.wallet">
        Saldo yang dapat dicairkan:
        <strong>{{ formatMoney(overview.wallet.balance, overview.wallet.currency) }}</strong>
      </p>
      <p v-else>Dompet Anda belum memiliki saldo.</p>

      <section class="rc-payouts__form" aria-labelledby="request-h">
        <h2 id="request-h">Ajukan pencairan</h2>
        <form @submit.prevent="request">
          <label>
            Jumlah (Rp)
            <input v-model.number="amount" class="rc-field" type="number" min="1" step="1" required />
          </label>
          <label>
            Bank
            <input v-model="bankName" class="rc-field" type="text" minlength="2" maxlength="80" required />
          </label>
          <label>
            Nomor rekening
            <input v-model="accountNumber" class="rc-field" type="text" inputmode="numeric" minlength="3" maxlength="40" required />
          </label>
          <label>
            Nama pemilik rekening
            <input v-model="accountName" class="rc-field" type="text" minlength="2" maxlength="120" required />
          </label>
          <button type="submit" class="rc-btn" :disabled="requesting">
            {{ requesting ? 'Mengirim...' : 'Ajukan' }}
          </button>
        </form>
        <p v-if="requested" role="status">Pengajuan pencairan diterima dan menunggu peninjauan.</p>
        <p v-if="requestError" role="alert">{{ requestError }}</p>
      </section>

      <section aria-labelledby="history-h">
        <h2 id="history-h">Riwayat pencairan</h2>
        <ul v-if="overview.payouts.length" class="rc-payouts__list">
          <li v-for="p in overview.payouts" :key="p.id" class="rc-payouts__item">
            <header>
              <div>
                <p class="rc-payouts__date">{{ formatDate(p.requestedAt) }}</p>
                <p class="rc-payouts__amount">{{ formatMoney(p.amount) }}</p>
                <p v-if="p.destinationInfo" class="rc-payouts__destination">
                  ke {{ p.destinationInfo.bankName }} · {{ p.destinationInfo.accountNumber }}
                </p>
              </div>
              <StatusBadge
                :tone="STATUS_META[p.status]?.tone ?? 'neutral'"
                :label="STATUS_META[p.status]?.label ?? p.status"
              />
            </header>
            <p v-if="p.status === 'REJECTED' && p.rejectionReason" class="rc-payouts__reason">
              Catatan: {{ p.rejectionReason }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada pencairan" message="Pencairan akan muncul di sini setelah Anda mengajukannya." />
      </section>
    </template>
  </main>
</template>

<style scoped>
.rc-payouts__form { margin-bottom: 1.5rem; }
.rc-payouts__form form {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}
.rc-payouts__form label {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-payouts__form input {
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
}
.rc-payouts__form button {
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
.rc-payouts__form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rc-payouts__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-payouts__item {
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
}
.rc-payouts__item header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.rc-payouts__date {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-payouts__amount { font-weight: 700; font-size: 1.125rem; }
.rc-payouts__destination { font-size: 0.75rem; color: var(--ui-text-muted); }
.rc-payouts__reason { font-size: 0.875rem; color: #b91c1c; margin-top: 0.5rem; }
</style>