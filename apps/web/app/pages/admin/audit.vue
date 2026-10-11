<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import { auditActionLabel, dayEndIso, dayStartIso, prettyJson } from '~/lib/admin';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime } from '~/lib/format';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService } from '~/services/admin';

definePageMeta({
  title: 'Audit — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Audit — ReduCera Admin' });

const defs = {
  page: { kind: 'page' },
  action: { kind: 'text', max: 100 },
  entityType: { kind: 'text', max: 100 },
  from: { kind: 'text', max: 10 },
  to: { kind: 'text', max: 10 },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const entityText = ref(String(filters.value.entityType ?? ''));

watch(
  () => filters.value.entityType,
  (value) => {
    entityText.value = String(value ?? '');
  },
);

const { data: actionNames } = useAsyncData('admin:audit:actions', () => adminService.audit.actions(), { lazy: true });

const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:audit',
  (current) =>
    adminService.audit.list({
      action: current.action,
      entityType: current.entityType,
      from: dayStartIso(String(current.from)),
      to: dayEndIso(String(current.to)),
      page: current.page,
      limit: 25,
    }),
  filters,
);

const selectedId = ref<string | null>(null);

const { data: detail, status: detailStatus, error: detailError } = useAsyncData(
  'admin:audit:detail',
  async () => (selectedId.value ? adminService.audit.get(selectedId.value) : null),
  { lazy: true, watch: [selectedId] },
);

function clearFilters() {
  entityText.value = '';
  set({ action: '', entityType: '', from: '', to: '' });
}

const hasFilters = computed(() => Boolean(filters.value.action || filters.value.entityType || filters.value.from || filters.value.to));
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Audit" subtitle="Jejak semua perubahan penting: siapa, apa, kapan, dan alasannya." />

    <form class="rc-toolbar" role="search" aria-label="Filter audit" @submit.prevent="set({ entityType: entityText })">
      <label>
        Aksi
        <select class="rc-field" :value="filters.action" @change="set({ action: ($event.target as HTMLSelectElement).value })">
          <option value="">Semua aksi</option>
          <option v-for="name in actionNames ?? []" :key="name" :value="name">{{ auditActionLabel(name) }}</option>
        </select>
      </label>
      <label>
        Objek
        <input v-model="entityText" type="search" maxlength="100" class="rc-field" placeholder="Contoh: Order" />
      </label>
      <label>
        Dari tanggal
        <input type="date" class="rc-field" :value="filters.from" @change="set({ from: ($event.target as HTMLInputElement).value })" />
      </label>
      <label>
        Sampai tanggal
        <input type="date" class="rc-field" :value="filters.to" @change="set({ to: ($event.target as HTMLInputElement).value })" />
      </label>
      <PlayButton type="submit" size="sm">Terapkan</PlayButton>
      <PlayButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters">Hapus filter</PlayButton>
    </form>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat audit"
      empty-title="Tidak ada catatan"
      empty-message="Belum ada catatan audit pada filter ini."
      :skeleton="6"
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Catatan audit</caption>
              <thead>
                <tr>
                  <th scope="col">Waktu</th>
                  <th scope="col">Aksi</th>
                  <th scope="col">Pelaku</th>
                  <th scope="col">Objek</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>{{ formatDateTime(row.createdAt) }}</td>
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="selectedId = row.id">
                      {{ auditActionLabel(row.action) }}
                    </button>
                    <span class="rc-table__sub">{{ row.action }}</span>
                  </td>
                  <td>
                    <template v-if="row.actor">
                      {{ row.actor.name }}
                      <span class="rc-table__sub">{{ row.actor.email }}</span>
                    </template>
                    <template v-else>Sistem</template>
                  </td>
                  <td>
                    {{ row.entityType }}
                    <span class="rc-table__sub">{{ row.entityId }}</span>
                  </td>
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

        <PlayCard v-if="selectedId" as="aside" class="rc-detail" aria-label="Detail catatan audit">
          <LoadingSkeleton v-if="detailStatus === 'pending'" variant="panel" />
          <p v-else-if="detailError" class="rc-alert rc-alert--error" role="alert">{{ describeApiError(detailError, 'Detail gagal dimuat.') }}</p>
          <template v-else-if="detail">
            <h2>{{ auditActionLabel(detail.action) }}</h2>
            <dl>
              <div><dt>Waktu</dt><dd>{{ formatDateTime(detail.createdAt) }}</dd></div>
              <div><dt>Pelaku</dt><dd>{{ detail.actor ? `${detail.actor.name} (${detail.actor.email})` : 'Sistem' }}</dd></div>
              <div><dt>Objek</dt><dd>{{ detail.entityType }} · {{ detail.entityId }}</dd></div>
              <div v-if="detail.reason"><dt>Alasan</dt><dd>{{ detail.reason }}</dd></div>
              <div v-if="detail.traceId"><dt>Trace</dt><dd>{{ detail.traceId }}</dd></div>
              <div v-if="detail.before"><dt>Sebelum</dt><dd><pre>{{ prettyJson(detail.before) }}</pre></dd></div>
              <div v-if="detail.after"><dt>Sesudah</dt><dd><pre>{{ prettyJson(detail.after) }}</pre></dd></div>
            </dl>
          </template>
        </PlayCard>
      </div>
    </AdminState>
  </div>
</template>
