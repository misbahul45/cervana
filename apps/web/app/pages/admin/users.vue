<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Pengguna Admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

const { data: users, isLoading } = useQuery({
  queryKey: QK.admin.users(),
  queryFn: async () => [
    { id: 'u-1', email: 'maya@redaucera.id', role: 'LEARNER', tenant: 'Universitas A' },
    { id: 'u-2', email: 'andi@redaucera.id', role: 'TEACHER', tenant: 'Universitas A' },
    { id: 'u-3', email: 'admin@redaucera.id', role: 'ADMIN', tenant: null },
  ],
  staleTime: 60_000,
});
</script>

<template>
  <main id="main" aria-labelledby="users-h">
    <PreviewNotice />
    <h1 id="users-h">Pengguna</h1>

    <LoadingSkeleton v-if="isLoading" variant="row" :count="3" />
    <table v-else-if="users && users.length" class="rc-admin-users__table">
      <thead>
        <tr><th>Email</th><th>Peran</th><th>Tenant</th></tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.email }}</td>
          <td>{{ u.role }}</td>
          <td>{{ u.tenant || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.rc-admin-users__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.rc-admin-users__table th,
.rc-admin-users__table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
}
</style>