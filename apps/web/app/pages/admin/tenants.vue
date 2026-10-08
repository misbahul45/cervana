<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Tenant Admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

const { data: tenants, isLoading } = useQuery({
  queryKey: QK.admin.tenants(),
  queryFn: async () => [
    { id: 't-1', name: 'Universitas A', memberCount: 1200, activeSince: '2025-08-01' },
    { id: 't-2', name: 'Universitas B', memberCount: 850, activeSince: '2026-01-12' },
  ],
  staleTime: 60_000,
});
</script>

<template>
  <main id="main" aria-labelledby="tenants-h">
    <PreviewNotice />
    <h1 id="tenants-h">Tenant</h1>

    <LoadingSkeleton v-if="isLoading" variant="row" :count="3" />
    <table v-else-if="tenants && tenants.length" class="rc-admin-tenants__table">
      <thead>
        <tr><th>Nama</th><th>Anggota</th><th>Aktif sejak</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tenants" :key="t.id">
          <td>{{ t.name }}</td>
          <td>{{ t.memberCount.toLocaleString('id-ID') }}</td>
          <td>{{ t.activeSince }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.rc-admin-tenants__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.rc-admin-tenants__table th,
.rc-admin-tenants__table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
}
</style>