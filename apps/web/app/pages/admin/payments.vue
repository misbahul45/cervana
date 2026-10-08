<script setup lang="ts">
import { adminPaymentsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderTitle } from '~/lib/order-status';
import { createIdempotencyKey } from '~/composables/useIdempotencyKey';
import type { ManualPaymentStatus } from '~/interfaces/commerce';

definePageMeta({
  title: 'Pembayaran — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

const STATUS_META: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  SUBMITTED: { label: 'Menunggu', tone: 'warning' },
  UNDER_REVIEW: { label: 'Ditinjau', tone: 'info' },
  APPROVED: { label: 'Disetujui', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'error' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
};

const statusFilter = ref<ManualPaymentStatus | ''>('');
const selectedId = ref<string | null>(null);
const reason = ref('');
const allowResubmit = ref(true);
const acting = ref(false);
const actionError = ref<string | null>(null);
const actionNotice = ref<string | null>(null);
const keys = new Map<string, ReturnType<typeof createIdempotencyKey>>();

const { data: queue, status, error, refresh } = useAsyncData(
  'admin:payments',
  () => adminPaymentsApi.queue(statusFilter.value || undefined),
  { lazy: true, watch: [statusFilter] },
);

const selected = computed(() => queue.value?.data.find((row) => row.id === selectedId.value) ?? null);

function keyFor(action: string, id: string) {
  const slot = `${action}:${id}`;
  if (!keys.has(slot)) keys.set(slot, createIdempotencyKey());
  return keys.get(slot)!;
}

function select(id: string) {
  selectedId.value = id;
  reason.value = '';
  actionError.value = null;
  actionNotice.value = null;
}

async function act(action: 'start-review' | 'approve' | 'reject') {
  const row = selected.value;
  if (!row || acting.value) return;
  if (action !== 'start-review' && reason.value.trim().length < 3) {
    actionError.value = 'Alasan wajib diisi (minimal 3 karakter).';
    return;
  }
  acting.value = true;
  actionError.value = null;
  actionNotice.value = null;
  const key = keyFor(action, row.id);
  try {
    if (action === 'start-review') await adminPaymentsApi.startReview(row.id, key.current());
    if (action === 'approve') await adminPaymentsApi.approve(row.id, reason.value.trim(), key.current());
    if (action === 'reject') await adminPaymentsApi.reject(row.id, reason.value.trim(), allowResubmit.value, key.current());
    key.reset();
    actionNotice.value = action === 'approve' ? 'Pembayaran disetujui.' : action === 'reject' ? 'Pembayaran ditolak.' : 'Peninjauan dimulai.';
    reason.value = '';
    await refresh();
  } catch (err) {
    actionError.value = describeApiError(err, 'Tindakan gagal. Coba lagi.');
  } finally {
    acting.value = false;
  }
}
</script>

<template>
  <main id="main" aria-labelledby="pm-h" class="rc-admin-payments">
    <h1 id="pm-h">Verifikasi Pembayaran</h1>

    <label class="rc-admin-payments__filter">
      Status
      <select v-model="statusFilter" class="rc-field">
        <option value="">Perlu ditinjau</option>
        <option value="APPROVED">Disetujui</option>
        <option value="REJECTED">Ditolak</option>
      </select>
    </label>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat pembayaran" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="!queue || queue.data.length === 0"
      title="Tidak ada pembayaran"
      message="Belum ada bukti pembayaran pada filter ini."
    />
    <div v-else class="rc-admin-payments__layout">
      <table class="rc-admin-payments__table">
        <thead>
          <tr><th>Pesanan</th><th>Pembeli</th><th>Jumlah</th><th>Status</th><th>Dikirim</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="row in queue.data"
            :key="row.id"
            :class="{ 'rc-admin-payments__row--active': row.id === selectedId }"
          >
            <td>
              <button type="button" class="rc-admin-payments__link" @click="select(row.id)">
                {{ orderTitle(row.order.items) }}
              </button>
            </td>
            <td>{{ row.payer.name }}</td>
            <td>{{ formatMoney(row.amount, row.order.currency) }}</td>
            <td><StatusBadge :tone="STATUS_META[row.status]?.tone ?? 'neutral'" :label="STATUS_META[row.status]?.label ?? row.status" /></td>
            <td>{{ formatDateTime(row.submittedAt) }}</td>
          </tr>
        </tbody>
      </table>

      <aside v-if="selected" class="rc-admin-payments__detail" aria-label="Detail pembayaran">
        <h2>{{ orderTitle(selected.order.items) }}</h2>
        <dl>
          <div><dt>Pembeli</dt><dd>{{ selected.payer.name }} ({{ selected.payer.email }})</dd></div>
          <div><dt>Jumlah</dt><dd>{{ formatMoney(selected.amount, selected.order.currency) }}</dd></div>
          <div><dt>Metode</dt><dd>{{ selected.paymentMethod }}</dd></div>
          <div v-if="selected.referenceNumber"><dt>Referensi</dt><dd>{{ selected.referenceNumber }}</dd></div>
          <div v-if="selected.note"><dt>Catatan</dt><dd>{{ selected.note }}</dd></div>
          <div v-if="selected.rejectionReason"><dt>Alasan penolakan</dt><dd>{{ selected.rejectionReason }}</dd></div>
        </dl>
        <a v-if="selected.proofUrl?.url" :href="selected.proofUrl.url" target="_blank" rel="noopener noreferrer" class="rc-admin-payments__proof">
          <img :src="selected.proofUrl.url" alt="Bukti transfer" loading="lazy" />
        </a>
        <p v-else role="note">Bukti transfer tidak tersedia.</p>

        <template v-if="selected.status === 'SUBMITTED' || selected.status === 'UNDER_REVIEW'">
          <button
            v-if="selected.status === 'SUBMITTED'"
            type="button"
            class="rc-btn rc-btn--sm rc-btn--secondary"
            :disabled="acting"
            @click="act('start-review')"
          >
            Mulai tinjau
          </button>
          <label class="rc-admin-payments__reason">
            Alasan
            <textarea v-model="reason" rows="2" maxlength="500" class="rc-field" />
          </label>
          <label class="rc-admin-payments__resubmit">
            <input v-model="allowResubmit" type="checkbox" />
            Izinkan unggah ulang bila ditolak
          </label>
          <div class="rc-admin-payments__actions">
            <button type="button" class="rc-btn" :disabled="acting" @click="act('approve')">Setujui pembayaran</button>
            <button type="button" class="rc-btn rc-btn--outline" :disabled="acting" @click="act('reject')">Tolak</button>
          </div>
        </template>

        <p v-if="actionNotice" role="status">{{ actionNotice }}</p>
        <p v-if="actionError" role="alert">{{ actionError }}</p>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.rc-admin-payments__filter {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 16rem;
  margin: 1rem 0;
  font-size: 0.875rem;
  color: var(--rc-muted);
}
.rc-admin-payments__layout {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}
@media (max-width: 960px) {
  .rc-admin-payments__layout { grid-template-columns: minmax(0, 1fr); }
}
.rc-admin-payments__table {
  width: 100%;
  border-collapse: collapse;
}
.rc-admin-payments__table th,
.rc-admin-payments__table td {
  padding: 0.625rem 0.5rem;
  border-bottom: 1px solid var(--rc-border);
  text-align: left;
  vertical-align: middle;
}
.rc-admin-payments__row--active { background: var(--rc-foam); }
.rc-admin-payments__link {
  color: var(--rc-primary);
  font-weight: 600;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}
.rc-admin-payments__detail {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  padding: 1rem;
  border: 1px solid var(--rc-border);
  border-radius: 1rem;
  background: var(--rc-surface);
}
.rc-admin-payments__detail dl { display: grid; gap: 0.375rem; margin: 0; }
.rc-admin-payments__detail dt { font-size: 0.75rem; color: var(--rc-muted); }
.rc-admin-payments__detail dd { margin: 0; font-weight: 600; word-break: break-word; }
.rc-admin-payments__proof img { max-width: 100%; border-radius: 0.75rem; border: 1px solid var(--rc-border); }
.rc-admin-payments__reason { display: grid; gap: 0.25rem; font-size: 0.875rem; }
.rc-admin-payments__resubmit { display: flex; gap: 0.5rem; align-items: center; font-size: 0.875rem; }
.rc-admin-payments__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
</style>
