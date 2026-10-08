<script setup lang="ts">
import { studioArticlesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate } from '~/lib/format';

definePageMeta({
  title: 'Daftar Artikel — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const { data: articles, status, error, refresh } = useAsyncData('studio:articles', () => studioArticlesApi.list(), {
  lazy: true,
});

const STATUS_META: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  DRAFT: { label: 'Draf', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Menunggu tinjauan', tone: 'info' },
  PUBLISHED: { label: 'Terbit', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'error' },
  SUSPENDED: { label: 'Ditangguhkan', tone: 'warning' },
  ARCHIVED: { label: 'Diarsipkan', tone: 'neutral' },
};
</script>

<template>
  <main id="main" aria-labelledby="articles-h">
    <header class="rc-studio-articles__head">
      <h1 id="articles-h">Artikel</h1>
      <NuxtLink to="/studio/articles/new">+ Artikel baru</NuxtLink>
    </header>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState
      v-else-if="error"
      title="Gagal memuat artikel"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <EmptyState
      v-else-if="!articles || articles.length === 0"
      title="Belum ada artikel"
      message="Mulai menulis artikel pertama Anda."
      cta-label="Artikel baru"
      cta-to="/studio/articles/new"
    />
    <ul v-else class="rc-studio-articles__list">
      <li v-for="a in articles" :key="a.id" class="rc-studio-articles__item">
        <NuxtLink :to="`/studio/articles/${a.id}`">
          <strong>{{ a.title }}</strong>
          <span>Diperbarui {{ formatDate(a.updatedAt) }}</span>
          <StatusBadge :tone="STATUS_META[a.status]?.tone ?? 'neutral'" :label="STATUS_META[a.status]?.label ?? a.status" />
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-studio-articles__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.rc-studio-articles__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-studio-articles__item a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
  color: var(--ui-text);
  text-decoration: none;
}
.rc-studio-articles__item a:hover { background: var(--ui-bg-muted, #f3f4f6); }
.rc-studio-articles__item span {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>