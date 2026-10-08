<script setup lang="ts">
import { studioArticlesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime } from '~/lib/format';

definePageMeta({
  title: 'Editor Artikel — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const route = useRoute();
const articleId = computed(() => String(route.params.id || ''));

const { data: article, status: loadStatus, error: loadError, refresh } = useAsyncData(
  () => `studio:article:${articleId.value}`,
  () => studioArticlesApi.get(articleId.value),
  { lazy: true, watch: [articleId] },
);

const title = ref('');
const body = ref('');
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'failed'>('idle');
const saveError = ref<string | null>(null);
const lastSavedAt = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const loaded = ref(false);

const EDITABLE = ['DRAFT', 'REJECTED'];
const editable = computed(() => !!article.value && EDITABLE.includes(article.value.status));

watch(
  article,
  (value) => {
    if (!value) return;
    const working = value.versions.find((version) => version.publishedAt === null) ?? value.versions[0];
    title.value = working?.title ?? value.title;
    body.value = working?.content ?? '';
    saveState.value = 'idle';
    loaded.value = true;
  },
  { immediate: true },
);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

watch([title, body], () => {
  if (!loaded.value || !editable.value) return;
  saveState.value = 'dirty';
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1500);
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
});

async function save() {
  if (saveState.value === 'saving' || !title.value.trim() || !body.value.trim()) return;
  saveState.value = 'saving';
  saveError.value = null;
  try {
    const saved = await studioArticlesApi.update(articleId.value, { title: title.value.trim(), content: body.value });
    lastSavedAt.value = saved.updatedAt;
    saveState.value = 'saved';
  } catch (err) {
    saveError.value = describeApiError(err, 'Perubahan gagal disimpan.');
    saveState.value = 'failed';
  }
}

async function submitForReview() {
  if (submitting.value || !editable.value) return;
  submitting.value = true;
  submitError.value = null;
  try {
    if (saveTimer) clearTimeout(saveTimer);
    await save();
    if (saveState.value === 'failed') return;
    await studioArticlesApi.submitReview(articleId.value);
    await refresh();
  } catch (err) {
    submitError.value = describeApiError(err, 'Artikel gagal diajukan untuk ditinjau.');
  } finally {
    submitting.value = false;
  }
}

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
  <main id="main" aria-labelledby="editor-h">
    <LoadingSkeleton v-if="loadStatus === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="loadError || !article"
      title="Artikel tidak dapat dimuat"
      :message="describeApiError(loadError)"
      @retry="refresh()"
    />
    <template v-else>
      <header class="rc-editor__head">
        <div>
          <NuxtLink to="/studio/articles">← Daftar artikel</NuxtLink>
          <h1 id="editor-h">Editor Artikel</h1>
          <StatusBadge
            :tone="STATUS_META[article.status]?.tone ?? 'neutral'"
            :label="STATUS_META[article.status]?.label ?? article.status"
          />
        </div>
        <div class="rc-editor__status" aria-live="polite">
          <span v-if="saveState === 'dirty'" class="rc-editor__dirty">Belum disimpan...</span>
          <span v-else-if="saveState === 'saving'">Menyimpan...</span>
          <span v-else-if="saveState === 'saved' && lastSavedAt" class="rc-editor__saved">
            Tersimpan {{ formatDateTime(lastSavedAt) }}
          </span>
        </div>
      </header>

      <p v-if="!editable" role="note">Artikel ini tidak dapat diubah saat berstatus {{ STATUS_META[article.status]?.label ?? article.status }}.</p>
      <p v-if="saveState === 'failed' && saveError" role="alert">
        {{ saveError }}
        <button type="button" @click="save">Coba simpan lagi</button>
      </p>

      <section class="rc-editor__form">
        <label>
          Judul
          <input v-model="title" type="text" class="rc-editor__title" :disabled="!editable" />
        </label>
        <label>
          Konten
          <textarea v-model="body" rows="18" class="rc-editor__body" :disabled="!editable" />
        </label>
      </section>

      <p v-if="submitError" role="alert">{{ submitError }}</p>
      <footer class="rc-editor__actions">
        <button
          type="button"
          :disabled="!editable || submitting || !title.trim() || !body.trim()"
          @click="submitForReview"
        >
          {{ submitting ? 'Mengirim...' : 'Kirim untuk ditinjau' }}
        </button>
        <NuxtLink to="/studio/articles">Kembali</NuxtLink>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.rc-editor__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
}
.rc-editor__status {
  text-align: right;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-editor__dirty { color: #d97706; }
.rc-editor__saved { color: #16a34a; }
.rc-editor__conflict {
  padding: 1rem;
  border-radius: 0.625rem;
  background: #fef3c7;
  border: 1px solid #d97706;
  margin-bottom: 1rem;
}
.rc-editor__conflict > div {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.rc-editor__conflict button {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.rc-editor__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.rc-editor__form label {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-editor__title {
  padding: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
}
.rc-editor__body {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.rc-editor__actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.rc-editor__actions button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
.rc-editor__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>