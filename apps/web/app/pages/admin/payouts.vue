<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { useQueueActions } from '~/composables/useQueueActions';
import type { AdminPayoutRow } from '~/interfaces/admin';
import { payoutActions, statusMeta } from '~/lib/admin';
import { uploadApi } from '~/lib/api';
import { formatDateTime, formatMoney } from '~/lib/format';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService, type UploadedEvidence } from '~/services/admin';

definePageMeta({
  title: 'Pencairan — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Pencairan — ReduCera Admin' });

const STATUSES = [
  { value: '', label: 'Semua' },
  { value: 'REQUESTED', label: 'Diajukan' },
  { value: 'UNDER_REVIEW', label: 'Ditinjau' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'PAID', label: 'Dibayar' },
  { value: 'REJECTED', label: 'Ditolak' },
] as const;

const defs = {
  page: { kind: 'page' },
  status: { kind: 'enum', values: STATUSES.map((item) => item.value).filter(Boolean) },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:payouts',
  (current) => adminService.payouts.list({ status: current.status, page: current.page, limit: 20 }),
  filters,
);

const actions = useQueueActions(async () => {
  await refresh();
});

const selectedId = ref<string | null>(null);
const dialog = ref<{ kind: 'reject' | 'mark-paid'; id: string } | null>(null);
const uploads = new Map<string, UploadedEvidence>();

const selected = computed<AdminPayoutRow | null>(() => rows.value.find((row) => row.id === selectedId.value) ?? null);

function select(id: string) {
  selectedId.value = id;
  actions.clear();
}

function open(kind: 'reject' | 'mark-paid', id: string) {
  actions.clear();
  dialog.value = { kind, id };
}

async function direct(action: 'start-review' | 'approve', row: AdminPayoutRow) {
  if (action === 'start-review') {
    await actions.run('start-review', row.id, (key) => adminService.payouts.startReview(row.id, key), 'Peninjauan dimulai.');
  } else {
    await actions.run('approve', row.id, (key) => adminService.payouts.approve(row.id, key), 'Pencairan disetujui.');
  }
}

async function reject(reason: string) {
  const target = dialog.value;
  if (!target) return;
  const ok = await actions.run('reject', target.id, (key) => adminService.payouts.reject(target.id, reason, key), 'Pencairan ditolak.');
  if (ok) dialog.value = null;
}

async function markPaid(payload: { file: File; note: string }) {
  const target = dialog.value;
  if (!target) return;
  const signature = `${target.id}:${payload.file.name}:${payload.file.size}:${payload.file.lastModified}`;
  const ok = await actions.run(
    'mark-paid',
    target.id,
    async (key) => {
      let evidence = uploads.get(signature);
      if (!evidence) {
        evidence = await uploadApi.proof(payload.file);
        uploads.set(signature, evidence);
      }
      await adminService.payouts.markPaid(target.id, { evidence, ...(payload.note ? { note: payload.note } : {}) }, key);
    },
    'Pencairan ditandai dibayar.',
  );
  if (ok) dialog.value = null;
}

const ACTION_LABEL = {
  'start-review': 'Mulai tinjau',
  approve: 'Setujui',
  reject: 'Tolak',
  'mark-paid': 'Tandai dibayar',
} as const;
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pencairan kreator" subtitle="Tinjau permintaan pencairan, setujui, lalu tandai dibayar dengan bukti transfer." />
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
      error-title="Gagal memuat pencairan"
      empty-title="Tidak ada pencairan"
      empty-message="Belum ada permintaan pencairan pada filter ini."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Permintaan pencairan</caption>
              <thead>
                <tr>
                  <th scope="col">Kreator</th>
                  <th scope="col">Tenant</th>
                  <th scope="col" class="rc-table__num">Jumlah</th>
                  <th scope="col">Status</th>
                  <th scope="col">Diajukan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row.id)">
                      {{ row.creator?.name ?? 'Tidak diketahui' }}
                    </button>
                    <span v-if="row.creator" class="rc-table__sub">{{ row.creator.email }}</span>
                  </td>
                  <td>{{ row.tenant?.name ?? '-' }}</td>
                  <td class="rc-table__num">{{ formatMoney(row.amount) }}</td>
                  <td><StatusBadge :tone="statusMeta('payout', row.status).tone" :label="statusMeta('payout', row.status).label" /></td>
                  <td>{{ formatDateTime(row.requestedAt) }}</td>
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

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail pencairan">
          <h2>{{ formatMoney(selected.amount) }}</h2>
          <dl>
            <div><dt>Kreator</dt><dd>{{ selected.creator?.name }} ({{ selected.creator?.email }})</dd></div>
            <div><dt>Tenant</dt><dd>{{ selected.tenant?.name ?? '-' }}</dd></div>
            <div v-if="selected.destinationInfo">
              <dt>Rekening tujuan</dt>
              <dd>{{ selected.destinationInfo.bankName }} · {{ selected.destinationInfo.accountNumber }} · {{ selected.destinationInfo.accountName }}</dd>
            </div>
            <div><dt>Diajukan</dt><dd>{{ formatDateTime(selected.requestedAt) }}</dd></div>
            <div v-if="selected.reviewedAt"><dt>Ditinjau</dt><dd>{{ formatDateTime(selected.reviewedAt) }}</dd></div>
            <div v-if="selected.paidAt"><dt>Dibayar</dt><dd>{{ formatDateTime(selected.paidAt) }}</dd></div>
            <div v-if="selected.rejectionReason"><dt>Alasan penolakan</dt><dd>{{ selected.rejectionReason }}</dd></div>
          </dl>
          <a v-if="selected.evidenceUrl" :href="selected.evidenceUrl" target="_blank" rel="noopener noreferrer" class="rc-admin-proof">
            <img :src="selected.evidenceUrl" alt="Bukti transfer pencairan" loading="lazy" />
          </a>
          <div v-if="payoutActions(selected.status).length" class="rc-actions">
            <PlayButton
              v-for="action in payoutActions(selected.status)"
              :key="action"
              :variant="action === 'reject' ? 'danger' : action === 'mark-paid' ? 'gold' : 'primary'"
              size="sm"
              :loading="actions.busy.value && (action === 'start-review' || action === 'approve')"
              @click="action === 'start-review' || action === 'approve' ? direct(action, selected) : open(action, selected.id)"
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
      title="Tolak pencairan"
      message="Alasan akan terlihat oleh kreator dan tercatat di audit."
      confirm-label="Tolak pencairan"
      destructive
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="reject"
      @cancel="dialog = null"
    />
    <AdminEvidenceDialog
      :open="dialog?.kind === 'mark-paid'"
      title="Tandai sudah dibayar"
      message="Unggah bukti transfer ke rekening kreator."
      confirm-label="Tandai dibayar"
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="markPaid"
      @cancel="dialog = null"
    />
  </div>
</template>
