<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { useQueueActions } from '~/composables/useQueueActions';
import type { AdminApplicationRow } from '~/interfaces/admin';
import { statusMeta } from '~/lib/admin';
import { formatDateTime } from '~/lib/format';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService } from '~/services/admin';

definePageMeta({
  title: 'Pendaftar kreator — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Pendaftar kreator — ReduCera Admin' });

const STATUSES = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
] as const;

const defs = {
  page: { kind: 'page' },
  status: { kind: 'enum', values: STATUSES.map((item) => item.value) },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const status = computed(() => String(filters.value.status || 'PENDING'));

const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:applications',
  (current) => adminService.applications.list({ status: current.status || 'PENDING', page: current.page, limit: 20 }),
  filters,
);

const actions = useQueueActions(async () => {
  await refresh();
});

const selectedId = ref<string | null>(null);
const dialog = ref<{ kind: 'approve' | 'reject'; id: string } | null>(null);

const selected = computed<AdminApplicationRow | null>(() => rows.value.find((row) => row.id === selectedId.value) ?? null);

function select(id: string) {
  selectedId.value = id;
  actions.clear();
}

function open(kind: 'approve' | 'reject', id: string) {
  actions.clear();
  dialog.value = { kind, id };
}

async function confirm(feedback: string) {
  const target = dialog.value;
  if (!target) return;
  const ok = await actions.run(
    target.kind,
    target.id,
    () =>
      target.kind === 'approve'
        ? adminService.applications.approve(target.id, feedback || undefined)
        : adminService.applications.reject(target.id, feedback),
    target.kind === 'approve' ? 'Pendaftar disetujui menjadi kreator.' : 'Pendaftaran ditolak.',
  );
  if (ok) dialog.value = null;
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pendaftar kreator" subtitle="Tinjau profil dan portofolio sebelum memberi akses menjadi kreator." />
    <p v-if="actions.notice.value" class="rc-alert rc-alert--success" role="status">{{ actions.notice.value }}</p>

    <div class="rc-toolbar">
      <label>
        Status
        <select class="rc-field" :value="status" @change="set({ status: ($event.target as HTMLSelectElement).value })">
          <option v-for="item in STATUSES" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
    </div>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat pendaftar"
      empty-title="Tidak ada pendaftar"
      empty-message="Belum ada pendaftaran pada status ini."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Pendaftar kreator</caption>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Keahlian</th>
                  <th scope="col">Status</th>
                  <th scope="col">Mendaftar</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row.id)">
                      {{ row.fullName }}
                    </button>
                    <span v-if="row.user" class="rc-table__sub">{{ row.user.email }}</span>
                  </td>
                  <td>{{ row.expertise ?? '-' }}</td>
                  <td><StatusBadge :tone="statusMeta('application', row.status).tone" :label="statusMeta('application', row.status).label" /></td>
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

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail pendaftar">
          <h2>{{ selected.fullName }}</h2>
          <dl>
            <div v-if="selected.user"><dt>Akun</dt><dd>{{ selected.user.name }} ({{ selected.user.email }})</dd></div>
            <div v-if="selected.expertise"><dt>Keahlian</dt><dd>{{ selected.expertise }}</dd></div>
            <div v-if="selected.bio"><dt>Tentang</dt><dd>{{ selected.bio }}</dd></div>
            <div v-if="selected.cvUrl">
              <dt>CV</dt>
              <dd><a :href="selected.cvUrl" target="_blank" rel="noopener noreferrer">Buka CV</a></dd>
            </div>
            <div v-if="selected.portfolioUrl">
              <dt>Portofolio</dt>
              <dd><a :href="selected.portfolioUrl" target="_blank" rel="noopener noreferrer">Buka portofolio</a></dd>
            </div>
            <div v-if="selected.feedback"><dt>Umpan balik</dt><dd>{{ selected.feedback }}</dd></div>
            <div v-if="selected.reviewedAt"><dt>Ditinjau</dt><dd>{{ formatDateTime(selected.reviewedAt) }}</dd></div>
          </dl>
          <div v-if="selected.status === 'PENDING'" class="rc-actions">
            <PlayButton size="sm" @click="open('approve', selected.id)">Setujui</PlayButton>
            <PlayButton variant="danger" size="sm" @click="open('reject', selected.id)">Tolak</PlayButton>
          </div>
        </PlayCard>
      </div>
    </AdminState>

    <AdminReasonDialog
      :open="dialog !== null"
      :title="dialog?.kind === 'approve' ? 'Setujui pendaftar' : 'Tolak pendaftaran'"
      :label="dialog?.kind === 'approve' ? 'Umpan balik (opsional)' : 'Umpan balik untuk pendaftar'"
      :confirm-label="dialog?.kind === 'approve' ? 'Setujui' : 'Tolak'"
      :destructive="dialog?.kind === 'reject'"
      :required="dialog?.kind === 'reject'"
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="confirm"
      @cancel="dialog = null"
    />
  </div>
</template>
