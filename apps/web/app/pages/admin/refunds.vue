<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { useQueueActions } from '~/composables/useQueueActions';
import type { AdminRefundRow } from '~/interfaces/admin';
import { refundActions, statusMeta } from '~/lib/admin';
import { uploadApi } from '~/lib/api';
import { formatDateTime, formatMoney } from '~/lib/format';
import { plainText } from '~/lib/topics';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService, type UploadedEvidence } from '~/services/admin';

definePageMeta({
  title: 'Pengembalian dana — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Pengembalian dana — ReduCera Admin' });

const STATUSES = [
  { value: '', label: 'Semua' },
  { value: 'REQUESTED', label: 'Diajukan' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'PROCESSED', label: 'Selesai' },
  { value: 'REJECTED', label: 'Ditolak' },
] as const;

const defs = {
  page: { kind: 'page' },
  status: { kind: 'enum', values: STATUSES.map((item) => item.value).filter(Boolean) },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:refunds',
  (current) => adminService.refunds.list({ status: current.status, page: current.page, limit: 20 }),
  filters,
);

const actions = useQueueActions(async () => {
  await refresh();
});

const selectedId = ref<string | null>(null);
const dialog = ref<{ kind: 'reject' | 'process'; id: string } | null>(null);
const uploads = new Map<string, UploadedEvidence>();

const selected = computed<AdminRefundRow | null>(() => rows.value.find((row) => row.id === selectedId.value) ?? null);

function select(id: string) {
  selectedId.value = id;
  actions.clear();
}

function open(kind: 'reject' | 'process', id: string) {
  actions.clear();
  dialog.value = { kind, id };
}

async function approve(row: AdminRefundRow) {
  await actions.run('approve', row.id, (key) => adminService.refunds.approve(row.id, key), 'Pengembalian dana disetujui.');
}

async function reject(reason: string) {
  const target = dialog.value;
  if (!target) return;
  const ok = await actions.run('reject', target.id, (key) => adminService.refunds.reject(target.id, reason, key), 'Pengembalian dana ditolak.');
  if (ok) dialog.value = null;
}

async function process(payload: { file: File; note: string }) {
  const target = dialog.value;
  if (!target) return;
  const signature = `${target.id}:${payload.file.name}:${payload.file.size}:${payload.file.lastModified}`;
  const ok = await actions.run(
    'process',
    target.id,
    async (key) => {
      let evidence = uploads.get(signature);
      if (!evidence) {
        evidence = await uploadApi.proof(payload.file);
        uploads.set(signature, evidence);
      }
      await adminService.refunds.process(target.id, { evidence, ...(payload.note ? { note: payload.note } : {}) }, key);
    },
    'Pengembalian dana diproses.',
  );
  if (ok) dialog.value = null;
}

const ACTION_LABEL = { approve: 'Setujui', reject: 'Tolak', process: 'Tandai selesai' } as const;
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pengembalian dana" subtitle="Setujui atau tolak permintaan, lalu selesaikan dengan bukti pengembalian ke pembeli." />
    <p v-if="actions.notice.value" class="rc-alert rc-alert--success" role="status">{{ actions.notice.value }}</p>

    <div class="rc-segment" role="group" aria-label="Filter status">
      <button
        v-for="item in STATUSES"
        :key="item.value"
        type="button"
        class="rc-segment__item"
        :aria-pressed="filters.status === item.value"
        @click="set({ status: item.value })"
      >
        {{ item.label }}
      </button>
    </div>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat pengembalian dana"
      empty-title="Tidak ada permintaan"
      empty-message="Belum ada permintaan pengembalian dana pada filter ini."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Permintaan pengembalian dana</caption>
              <thead>
                <tr>
                  <th scope="col">Pemohon</th>
                  <th scope="col">Alasan</th>
                  <th scope="col" class="rc-table__num">Jumlah</th>
                  <th scope="col">Status</th>
                  <th scope="col">Diajukan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row.id)">
                      {{ row.requestedBy?.name ?? 'Tidak diketahui' }}
                    </button>
                    <span v-if="row.requestedBy" class="rc-table__sub">{{ row.requestedBy.email }}</span>
                  </td>
                  <td>{{ plainText(row.reason, 60) }}</td>
                  <td class="rc-table__num">{{ formatMoney(row.amount, row.order?.currency) }}</td>
                  <td><StatusBadge :tone="statusMeta('refund', row.status).tone" :label="statusMeta('refund', row.status).label" /></td>
                  <td>{{ formatDateTime(row.createdAt) }}</td>
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

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail pengembalian dana">
          <h2>{{ formatMoney(selected.amount, selected.order?.currency) }}</h2>
          <dl>
            <div><dt>Pemohon</dt><dd>{{ selected.requestedBy?.name }} ({{ selected.requestedBy?.email }})</dd></div>
            <div><dt>Alasan</dt><dd>{{ selected.reason }}</dd></div>
            <div v-if="selected.order"><dt>Total pesanan</dt><dd>{{ formatMoney(selected.order.total, selected.order.currency) }}</dd></div>
            <div><dt>Diajukan</dt><dd>{{ formatDateTime(selected.createdAt) }}</dd></div>
            <div v-if="selected.approvedAt"><dt>Disetujui</dt><dd>{{ formatDateTime(selected.approvedAt) }}</dd></div>
            <div v-if="selected.processedAt"><dt>Selesai</dt><dd>{{ formatDateTime(selected.processedAt) }}</dd></div>
            <div v-if="selected.rejectionReason"><dt>Alasan penolakan</dt><dd>{{ selected.rejectionReason }}</dd></div>
          </dl>
          <a v-if="selected.evidenceUrl" :href="selected.evidenceUrl" target="_blank" rel="noopener noreferrer" class="rc-admin-proof">
            <img :src="selected.evidenceUrl" alt="Bukti pengembalian dana" loading="lazy" />
          </a>
          <div v-if="refundActions(selected.status).length" class="rc-actions">
            <PlayButton
              v-for="action in refundActions(selected.status)"
              :key="action"
              :variant="action === 'reject' ? 'danger' : 'primary'"
              size="sm"
              :loading="actions.busy.value && action === 'approve'"
              @click="action === 'approve' ? approve(selected) : open(action, selected.id)"
            >
              {{ ACTION_LABEL[action] }}
            </PlayButton>
          </div>
          <p v-if="actions.error.value && !dialog" class="rc-alert rc-alert--error" role="alert">{{ actions.error.value }}</p>
        </PlayCard>
      </div>
    </AdminState>

    <AdminReasonDialog
      :open="dialog?.kind === 'reject'"
      title="Tolak pengembalian dana"
      message="Alasan akan terlihat oleh pembeli dan tercatat di audit."
      confirm-label="Tolak"
      destructive
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="reject"
      @cancel="dialog = null"
    />
    <AdminEvidenceDialog
      :open="dialog?.kind === 'process'"
      title="Tandai pengembalian selesai"
      message="Unggah bukti bahwa dana sudah dikembalikan ke pembeli."
      confirm-label="Tandai selesai"
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="process"
      @cancel="dialog = null"
    />
  </div>
</template>
