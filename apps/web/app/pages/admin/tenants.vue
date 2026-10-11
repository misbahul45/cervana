<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { useQueueActions } from '~/composables/useQueueActions';
import type { AdminTenantRow } from '~/interfaces/admin';
import { statusMeta, tenantAction } from '~/lib/admin';
import { formatDate } from '~/lib/format';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService } from '~/services/admin';

definePageMeta({
  title: 'Tenant — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Tenant — ReduCera Admin' });

const defs = {
  page: { kind: 'page' },
  q: { kind: 'text', max: 100 },
  status: { kind: 'enum', values: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const search = ref(String(filters.value.q ?? ''));

watch(
  () => filters.value.q,
  (value) => {
    search.value = String(value ?? '');
  },
);

const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:tenants',
  (current) => adminService.tenants.list({ q: current.q, status: current.status, page: current.page, limit: 20 }),
  filters,
);

const actions = useQueueActions(async () => {
  await refresh();
});

const selectedId = ref<string | null>(null);
const dialog = ref(false);

const selected = computed<AdminTenantRow | null>(() => rows.value.find((row) => row.id === selectedId.value) ?? null);
const move = computed(() => (selected.value ? tenantAction(selected.value.status) : null));

function select(id: string) {
  selectedId.value = id;
  actions.clear();
}

function open() {
  actions.clear();
  dialog.value = true;
}

async function confirm(reason: string) {
  const row = selected.value;
  const action = move.value;
  if (!row || !action) return;
  const ok = await actions.run(
    action,
    row.id,
    () => (action === 'suspend' ? adminService.tenants.suspend(row.id, reason) : adminService.tenants.activate(row.id, reason)),
    action === 'suspend' ? 'Tenant ditangguhkan.' : 'Tenant diaktifkan.',
  );
  if (ok) dialog.value = false;
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Tenant" subtitle="Organisasi kreator di marketplace. Menangguhkan tenant menyembunyikan produknya dari pembeli." />
    <p v-if="actions.notice.value" class="rc-alert rc-alert--success" role="status">{{ actions.notice.value }}</p>

    <form class="rc-toolbar" role="search" aria-label="Cari tenant" @submit.prevent="set({ q: search })">
      <label class="rc-toolbar__grow">
        Cari nama atau slug
        <input v-model="search" type="search" maxlength="100" class="rc-field" />
      </label>
      <label>
        Status
        <select class="rc-field" :value="filters.status" @change="set({ status: ($event.target as HTMLSelectElement).value })">
          <option value="">Semua</option>
          <option value="ACTIVE">Aktif</option>
          <option value="SUSPENDED">Ditangguhkan</option>
          <option value="ARCHIVED">Diarsipkan</option>
        </select>
      </label>
      <PlayButton type="submit" size="sm">Cari</PlayButton>
    </form>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat tenant"
      empty-title="Tenant tidak ditemukan"
      empty-message="Ubah kata kunci atau filter."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Daftar tenant</caption>
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row.id)">
                      {{ row.name }}
                    </button>
                    <span class="rc-table__sub">{{ row.slug }}</span>
                  </td>
                  <td><StatusBadge :tone="statusMeta('tenant', row.status).tone" :label="statusMeta('tenant', row.status).label" /></td>
                  <td>{{ formatDate(row.createdAt) }}</td>
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

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail tenant">
          <h2>{{ selected.name }}</h2>
          <dl>
            <div><dt>Slug</dt><dd>{{ selected.slug }}</dd></div>
            <div v-if="selected.description"><dt>Deskripsi</dt><dd>{{ selected.description }}</dd></div>
            <div><dt>Status</dt><dd>{{ statusMeta('tenant', selected.status).label }}</dd></div>
            <div><dt>Dibuat</dt><dd>{{ formatDate(selected.createdAt) }}</dd></div>
          </dl>
          <div v-if="move" class="rc-actions">
            <PlayButton :variant="move === 'suspend' ? 'danger' : 'primary'" size="sm" @click="open">
              {{ move === 'suspend' ? 'Tangguhkan tenant' : 'Aktifkan tenant' }}
            </PlayButton>
          </div>
        </PlayCard>
      </div>
    </AdminState>

    <AdminReasonDialog
      :open="dialog"
      :title="move === 'suspend' ? 'Tangguhkan tenant' : 'Aktifkan tenant'"
      message="Alasan dicatat di audit."
      :confirm-label="move === 'suspend' ? 'Tangguhkan' : 'Aktifkan'"
      :destructive="move === 'suspend'"
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="confirm"
      @cancel="dialog = false"
    />
  </div>
</template>
