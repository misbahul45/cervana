<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { tenantsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Pengaturan — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] },
  layout: 'studio',
});

useHead({ title: 'Pengaturan — ReduCera Studio' });

const ROLES: Record<string, string> = { OWNER: 'Pemilik', MANAGER: 'Manajer', TEACHER: 'Pengajar', EDITOR: 'Editor' };

const { data: tenants, status, error, refresh } = useAsyncData('studio:tenants', () => tenantsApi.mine(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pengaturan studio" subtitle="Studio tempat kamu menjadi anggota dan peranmu di sana.">
      <template #actions>
        <PlayButton to="/studio/payouts" variant="secondary" size="sm">Rekening pencairan</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="2" />
    <ErrorState v-else-if="error" title="Gagal memuat studio" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState v-else-if="!tenants || tenants.length === 0" title="Belum ada studio" message="Kamu belum menjadi anggota studio mana pun." />
    <ul v-else class="rc-studio-list" aria-label="Studio saya">
      <li v-for="tenant in tenants" :key="tenant.id" class="rc-card">
        <div class="rc-studio-list__main">
          <p class="rc-studio-list__title">{{ tenant.name }}</p>
          <p class="rc-hint">Peran: {{ ROLES[tenant.membershipRole] ?? tenant.membershipRole }}</p>
        </div>
        <StatusBadge :tone="statusMeta('tenant', tenant.status).tone" :label="statusMeta('tenant', tenant.status).label" />
      </li>
    </ul>
  </div>
</template>
