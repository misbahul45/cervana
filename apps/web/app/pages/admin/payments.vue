<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { createIdempotencyKey } from '~/composables/useIdempotencyKey';
import type { ManualPaymentStatus } from '~/interfaces/commerce';
import { statusMeta, reasonProblem } from '~/lib/admin';
import { adminPaymentsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderTitle } from '~/lib/order-status';
import type { FilterDefs } from '~/lib/query-filters';

definePageMeta({
  title: 'Pembayaran — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Pembayaran — ReduCera Admin' });

const defs = {
  page: { kind: 'page' },
  status: { kind: 'enum', values: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:payments',
  (current) =>
    adminPaymentsApi.queue((current.status || undefined) as ManualPaymentStatus | undefined, Number(current.page)),
  filters,
);

const selectedId = ref<string | null>(null);
const reason = ref('');
const allowResubmit = ref(true);
const acting = ref(false);
const actionError = ref<string | null>(null);
const actionNotice = ref<string | null>(null);
const keys = new Map<string, ReturnType<typeof createIdempotencyKey>>();

const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null);

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
  if (action !== 'start-review') {
    const problem = reasonProblem(reason.value);
    if (problem) {
      actionError.value = problem;
      return;
    }
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
  <div class="rc-stack">
    <PageHeader title="Verifikasi pembayaran" subtitle="Periksa bukti transfer, lalu setujui atau tolak dengan alasan yang tercatat." />
    <p v-if="actionNotice" class="rc-alert rc-alert--success" role="status">{{ actionNotice }}</p>

    <div class="rc-toolbar">
      <label>
        Status
        <select class="rc-field" :value="filters.status" @change="set({ status: ($event.target as HTMLSelectElement).value })">
          <option value="">Perlu ditinjau</option>
          <option value="UNDER_REVIEW">Sedang ditinjau</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
          <option value="EXPIRED">Kedaluwarsa</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </label>
    </div>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat pembayaran"
      empty-title="Tidak ada pembayaran"
      empty-message="Belum ada bukti pembayaran pada filter ini."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Antrean verifikasi pembayaran</caption>
              <thead>
                <tr>
                  <th scope="col">Pesanan</th>
                  <th scope="col">Pembeli</th>
                  <th scope="col" class="rc-table__num">Jumlah</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dikirim</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row.id)">
                      {{ orderTitle(row.order.items) }}
                    </button>
                  </td>
                  <td>{{ row.payer.name }}</td>
                  <td class="rc-table__num">{{ formatMoney(row.amount, row.order.currency) }}</td>
                  <td><StatusBadge :tone="statusMeta('payment', row.status).tone" :label="statusMeta('payment', row.status).label" /></td>
                  <td>{{ formatDateTime(row.submittedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <AdminPager
            v-if="pagination"
            :page="pagination.page"
            :total-pages="pagination.totalPages"
            :total="pagination.total"
            @change="set({ page: $event })"
          />
        </div>

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail pembayaran">
          <h2>{{ orderTitle(selected.order.items) }}</h2>
          <dl>
            <div><dt>Pembeli</dt><dd>{{ selected.payer.name }} ({{ selected.payer.email }})</dd></div>
            <div><dt>Jumlah</dt><dd>{{ formatMoney(selected.amount, selected.order.currency) }}</dd></div>
            <div><dt>Metode</dt><dd>{{ selected.paymentMethod }}</dd></div>
            <div v-if="selected.referenceNumber"><dt>Referensi</dt><dd>{{ selected.referenceNumber }}</dd></div>
            <div v-if="selected.note"><dt>Catatan</dt><dd>{{ selected.note }}</dd></div>
            <div v-if="selected.rejectionReason"><dt>Alasan penolakan</dt><dd>{{ selected.rejectionReason }}</dd></div>
          </dl>
          <a v-if="selected.proofUrl?.url" :href="selected.proofUrl.url" target="_blank" rel="noopener noreferrer" class="rc-admin-proof">
            <img :src="selected.proofUrl.url" alt="Bukti transfer" loading="lazy" />
          </a>
          <p v-else class="rc-hint">Bukti transfer tidak tersedia.</p>

          <template v-if="selected.status === 'SUBMITTED' || selected.status === 'UNDER_REVIEW'">
            <PlayButton v-if="selected.status === 'SUBMITTED'" variant="secondary" size="sm" :loading="acting" @click="act('start-review')">
              Mulai tinjau
            </PlayButton>
            <label class="rc-label">
              Alasan
              <textarea v-model="reason" rows="2" maxlength="500" class="rc-field" />
            </label>
            <label class="rc-check">
              <input v-model="allowResubmit" type="checkbox" />
              Izinkan unggah ulang bila ditolak
            </label>
            <div class="rc-actions">
              <PlayButton :loading="acting" @click="act('approve')">Setujui</PlayButton>
              <PlayButton variant="danger" :loading="acting" @click="act('reject')">Tolak</PlayButton>
            </div>
          </template>

          <p v-if="actionError" class="rc-alert rc-alert--error" role="alert">{{ actionError }}</p>
        </PlayCard>
      </div>
    </AdminState>
  </div>
</template>
