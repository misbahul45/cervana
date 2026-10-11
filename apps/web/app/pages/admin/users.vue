<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { useQueueActions } from '~/composables/useQueueActions';
import type { AdminUserRow } from '~/interfaces/admin';
import type { User } from '~/interfaces/auth';
import { ROLE_VALUES, canChangeAccount, roleLabel } from '~/lib/admin';
import { formatDate } from '~/lib/format';
import type { FilterDefs } from '~/lib/query-filters';
import { adminService } from '~/services/admin';

definePageMeta({
  title: 'Pengguna — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Pengguna — ReduCera Admin' });

const defs = {
  page: { kind: 'page' },
  q: { kind: 'text', max: 100 },
  role: { kind: 'enum', values: ROLE_VALUES },
  active: { kind: 'enum', values: ['true', 'false'] },
} satisfies FilterDefs;

const me = useState<User | null>('user');
const { filters, set } = useQueryFilters(defs);
const search = ref(String(filters.value.q ?? ''));

watch(
  () => filters.value.q,
  (value) => {
    search.value = String(value ?? '');
  },
);

const { rows, pagination, state, error, refresh } = useAdminList(
  'admin:users',
  (current) =>
    adminService.users.list({
      q: current.q,
      role: current.role,
      isActive: current.active,
      page: current.page,
      limit: 20,
      sort: 'createdAt:desc',
    }),
  filters,
);

const actions = useQueueActions(async () => {
  await refresh();
});

const selectedId = ref<string | null>(null);
const nextRole = ref<string>('STUDENT');
const dialog = ref<'role' | 'activation' | null>(null);

const selected = computed<AdminUserRow | null>(() => rows.value.find((row) => row.id === selectedId.value) ?? null);
const editable = computed(() => (selected.value ? canChangeAccount(me.value?.id, selected.value.id) : false));

function select(row: AdminUserRow) {
  selectedId.value = row.id;
  nextRole.value = row.role;
  actions.clear();
}

function open(kind: 'role' | 'activation') {
  actions.clear();
  dialog.value = kind;
}

async function confirm(reason: string) {
  const row = selected.value;
  if (!row || !dialog.value) return;
  const kind = dialog.value;
  const ok = await actions.run(
    kind,
    row.id,
    () => (kind === 'role' ? adminService.users.setRole(row.id, nextRole.value, reason) : adminService.users.setActivation(row.id, !row.isActive, reason)),
    kind === 'role' ? 'Peran pengguna diubah.' : row.isActive ? 'Akun dinonaktifkan.' : 'Akun diaktifkan.',
  );
  if (ok) dialog.value = null;
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pengguna" subtitle="Cari akun, ubah peran, atau nonaktifkan akun. Setiap perubahan tercatat di audit." />
    <p v-if="actions.notice.value" class="rc-alert rc-alert--success" role="status">{{ actions.notice.value }}</p>

    <form class="rc-toolbar" role="search" aria-label="Cari pengguna" @submit.prevent="set({ q: search })">
      <label class="rc-toolbar__grow">
        Cari nama atau email
        <input v-model="search" type="search" maxlength="100" class="rc-field" placeholder="Contoh: maya" />
      </label>
      <label>
        Peran
        <select class="rc-field" :value="filters.role" @change="set({ role: ($event.target as HTMLSelectElement).value })">
          <option value="">Semua</option>
          <option v-for="role in ROLE_VALUES" :key="role" :value="role">{{ roleLabel(role) }}</option>
        </select>
      </label>
      <label>
        Akun
        <select class="rc-field" :value="filters.active" @change="set({ active: ($event.target as HTMLSelectElement).value })">
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </label>
      <PlayButton type="submit" size="sm">Cari</PlayButton>
    </form>

    <AdminState
      :status="state"
      :error="error"
      :empty="rows.length === 0"
      error-title="Gagal memuat pengguna"
      empty-title="Pengguna tidak ditemukan"
      empty-message="Ubah kata kunci atau filter."
      @retry="refresh()"
    >
      <div class="rc-split rc-split--detail">
        <div>
          <div class="rc-table-wrap">
            <table class="rc-table">
              <caption>Daftar pengguna</caption>
              <thead>
                <tr>
                  <th scope="col">Pengguna</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Akun</th>
                  <th scope="col">Bergabung</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id" :class="{ 'is-selected': row.id === selectedId }">
                  <td>
                    <button type="button" class="rc-table__link" :aria-pressed="row.id === selectedId" @click="select(row)">
                      {{ row.name }}
                    </button>
                    <span class="rc-table__sub">{{ row.email }}</span>
                  </td>
                  <td>{{ roleLabel(row.role) }}</td>
                  <td><StatusBadge :tone="row.isActive ? 'success' : 'error'" :label="row.isActive ? 'Aktif' : 'Nonaktif'" /></td>
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

        <PlayCard v-if="selected" as="aside" class="rc-detail" aria-label="Detail pengguna">
          <h2>{{ selected.name }}</h2>
          <dl>
            <div><dt>Email</dt><dd>{{ selected.email }}</dd></div>
            <div><dt>Peran</dt><dd>{{ roleLabel(selected.role) }}</dd></div>
            <div><dt>Poin</dt><dd>{{ selected.totalPoints }} XP · {{ selected.stars }} bintang · streak {{ selected.currentStreak }}</dd></div>
            <div><dt>Bergabung</dt><dd>{{ formatDate(selected.createdAt) }}</dd></div>
          </dl>

          <p v-if="!editable" class="rc-hint">Akunmu sendiri tidak bisa diubah dari sini.</p>
          <template v-else>
            <label class="rc-label">
              Peran baru
              <select v-model="nextRole" class="rc-field">
                <option v-for="role in ROLE_VALUES" :key="role" :value="role">{{ roleLabel(role) }}</option>
              </select>
            </label>
            <div class="rc-actions">
              <PlayButton size="sm" :disabled="nextRole === selected.role" @click="open('role')">Ubah peran</PlayButton>
              <PlayButton :variant="selected.isActive ? 'danger' : 'secondary'" size="sm" @click="open('activation')">
                {{ selected.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun' }}
              </PlayButton>
            </div>
          </template>
        </PlayCard>
      </div>
    </AdminState>

    <AdminReasonDialog
      :open="dialog !== null"
      :title="dialog === 'role' ? `Ubah peran menjadi ${roleLabel(nextRole)}` : selected?.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'"
      message="Alasan dicatat di audit dan tidak bisa diubah."
      :confirm-label="dialog === 'role' ? 'Ubah peran' : selected?.isActive ? 'Nonaktifkan' : 'Aktifkan'"
      :destructive="dialog === 'activation' && selected?.isActive"
      :busy="actions.busy.value"
      :error="actions.error.value"
      @confirm="confirm"
      @cancel="dialog = null"
    />
  </div>
</template>
