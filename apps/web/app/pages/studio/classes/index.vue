<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { studioClassesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate } from '~/lib/format';
import { classMeta, priceText } from '~/lib/marketplace';

definePageMeta({
  title: 'Kelas — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Kelas — ReduCera Studio' });

const { data: classes, status, error, refresh } = useAsyncData('studio:classes', () => studioClassesApi.list(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Kelas" subtitle="Semua kelas milik studio kamu.">
      <template #actions>
        <PlayButton to="/studio/classes/new" size="sm">Kelas baru</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat kelas" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="!classes || classes.length === 0"
      title="Belum ada kelas"
      message="Buat kelas pertamamu dan atur jadwal sesinya."
      cta-label="Buat kelas"
      cta-to="/studio/classes/new"
    />
    <ul v-else class="rc-studio-list" aria-label="Daftar kelas">
      <li v-for="item in classes" :key="item.id" class="rc-card">
        <div class="rc-studio-list__main">
          <p class="rc-studio-list__title">{{ item.title }}</p>
          <p class="rc-hint">
            {{ classMeta(item).join(' · ') }} · {{ priceText(item.accessType, item.price, item.currency) }} · diperbarui {{ formatDate(item.updatedAt) }}
          </p>
        </div>
        <StatusBadge :tone="statusMeta('content', item.status).tone" :label="statusMeta('content', item.status).label" />
        <div class="rc-actions">
          <PlayButton :to="`/studio/classes/${item.id}`" variant="secondary" size="sm">Kelola</PlayButton>
          <PlayButton v-if="item.status === 'PUBLISHED'" :to="`/marketplace/classes/${item.id}`" variant="ghost" size="sm">Lihat di marketplace</PlayButton>
        </div>
      </li>
    </ul>
  </div>
</template>
