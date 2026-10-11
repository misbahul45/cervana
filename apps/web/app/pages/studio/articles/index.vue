<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { studioArticlesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate } from '~/lib/format';

definePageMeta({
  title: 'Artikel — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Artikel — ReduCera Studio' });

const { data: articles, status, error, refresh } = useAsyncData('studio:articles', () => studioArticlesApi.list(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Artikel" subtitle="Semua artikel milik studio kamu.">
      <template #actions>
        <PlayButton to="/studio/articles/new" size="sm">Artikel baru</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat artikel" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="!articles || articles.length === 0"
      title="Belum ada artikel"
      message="Mulai menulis artikel pertamamu."
      cta-label="Tulis artikel"
      cta-to="/studio/articles/new"
    />
    <ul v-else class="rc-studio-list" aria-label="Daftar artikel">
      <li v-for="article in articles" :key="article.id" class="rc-card">
        <div class="rc-studio-list__main">
          <p class="rc-studio-list__title">{{ article.title }}</p>
          <p class="rc-hint">Diperbarui {{ formatDate(article.updatedAt) }}</p>
        </div>
        <StatusBadge :tone="statusMeta('content', article.status).tone" :label="statusMeta('content', article.status).label" />
        <div class="rc-actions">
          <PlayButton :to="`/studio/articles/${article.id}`" variant="secondary" size="sm">
            {{ article.status === 'DRAFT' || article.status === 'REJECTED' ? 'Edit' : 'Buka' }}
          </PlayButton>
          <PlayButton v-if="article.status === 'PUBLISHED'" :to="`/marketplace/articles/${article.id}`" variant="ghost" size="sm">Lihat di marketplace</PlayButton>
        </div>
      </li>
    </ul>
  </div>
</template>
