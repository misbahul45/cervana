<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';
import StudioWriter from '~/components/studio/StudioWriter.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { studioArticlesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime } from '~/lib/format';
import { articlePayload, articleProblem, isEditable } from '~/lib/studio';

definePageMeta({
  title: 'Editor Artikel — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const route = useRoute();
const articleId = computed(() => String(route.params.id || ''));

const { data: article, status: loadStatus, error: loadError, refresh } = await useAsyncData(
  () => `studio:article:${articleId.value}`,
  () => studioArticlesApi.get(articleId.value),
  { watch: [articleId] },
);

const form = reactive({
  title: '',
  subtitle: '',
  body: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
});

const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'failed'>('idle');
const saveError = ref<string | null>(null);
const lastSavedAt = ref<string | null>(null);
const acting = ref(false);
const actionError = ref<string | null>(null);
const loaded = ref(false);
let savedSnapshot = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const editable = computed(() => !!article.value && isEditable(article.value.status));
const meta = computed(() => (article.value ? statusMeta('content', article.value.status) : null));

function snapshot() {
  return JSON.stringify(articlePayload(form));
}

watch(
  article,
  (value) => {
    if (!value) return;
    const working = value.versions.find((version) => version.publishedAt === null) ?? value.versions[0];
    form.title = working?.title ?? value.title;
    form.body = working?.content ?? '';
    form.subtitle = value.excerpt ?? '';
    form.accessType = value.accessType;
    form.price = value.price === null || value.price === undefined ? null : Math.round(Number(value.price));
    savedSnapshot = snapshot();
    saveState.value = 'idle';
    loaded.value = true;
  },
  { immediate: true },
);

watch(form, () => {
  if (!loaded.value || !editable.value) return;
  if (snapshot() === savedSnapshot) {
    saveState.value = saveState.value === 'dirty' ? 'idle' : saveState.value;
    return;
  }
  saveState.value = 'dirty';
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1500);
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
});

async function save(): Promise<boolean> {
  if (saveTimer) clearTimeout(saveTimer);
  if (saveState.value === 'saving') return false;
  if (snapshot() === savedSnapshot) return true;
  const problem = articleProblem(form);
  if (problem) {
    saveError.value = problem;
    saveState.value = 'failed';
    return false;
  }
  saveState.value = 'saving';
  saveError.value = null;
  const sent = snapshot();
  try {
    const saved = await studioArticlesApi.update(articleId.value, articlePayload(form));
    savedSnapshot = sent;
    lastSavedAt.value = saved.updatedAt;
    saveState.value = snapshot() === sent ? 'saved' : 'dirty';
    return true;
  } catch (err) {
    saveError.value = describeApiError(err, 'Perubahan gagal disimpan.');
    saveState.value = 'failed';
    return false;
  }
}

async function submitForReview() {
  if (acting.value || !editable.value) return;
  acting.value = true;
  actionError.value = null;
  try {
    if (!(await save())) return;
    await studioArticlesApi.submitReview(articleId.value);
    await refresh();
  } catch (err) {
    actionError.value = describeApiError(err, 'Artikel gagal dikirim untuk ditinjau.');
  } finally {
    acting.value = false;
  }
}

async function withdraw() {
  if (acting.value) return;
  acting.value = true;
  actionError.value = null;
  try {
    await studioArticlesApi.withdraw(articleId.value);
    await refresh();
  } catch (err) {
    actionError.value = describeApiError(err, 'Pengajuan gagal ditarik.');
  } finally {
    acting.value = false;
  }
}

useHead({ title: () => (form.title ? `${form.title} — Studio` : 'Editor Artikel — Studio') });
</script>

<template>
  <div class="rc-stack">
    <LoadingSkeleton v-if="loadStatus === 'pending' && !article" variant="panel" :count="2" />
    <ErrorState v-else-if="loadError || !article" title="Artikel tidak dapat dimuat" :message="describeApiError(loadError)" @retry="refresh()" />

    <template v-else>
      <h1 class="sr-only">Editor artikel</h1>
      <div class="rc-editor-head">
        <div class="rc-actions">
          <PlayButton to="/studio/articles" variant="ghost" size="sm">Kembali ke daftar</PlayButton>
          <StatusBadge v-if="meta" :tone="meta.tone" :label="meta.label" />
        </div>
        <div class="rc-actions">
          <span class="rc-editor-head__status" aria-live="polite">
            <template v-if="saveState === 'dirty'">Belum disimpan…</template>
            <template v-else-if="saveState === 'saving'">Menyimpan…</template>
            <template v-else-if="saveState === 'saved' && lastSavedAt">Tersimpan {{ formatDateTime(lastSavedAt) }}</template>
          </span>
          <PlayButton v-if="editable" variant="secondary" size="sm" @click="save">Simpan</PlayButton>
          <PlayButton v-if="editable" size="sm" :loading="acting" @click="submitForReview">Kirim untuk ditinjau</PlayButton>
          <PlayButton v-else-if="article.status === 'PENDING_REVIEW'" variant="secondary" size="sm" :loading="acting" @click="withdraw">Tarik pengajuan</PlayButton>
          <PlayButton v-if="article.status === 'PUBLISHED'" :to="`/marketplace/articles/${article.id}`" size="sm">Lihat di marketplace</PlayButton>
        </div>
      </div>

      <p v-if="article.status === 'REJECTED' && article.reviewNote" class="rc-alert rc-alert--error" role="note">
        Catatan peninjau: {{ article.reviewNote }}
      </p>
      <p v-if="!editable && article.status !== 'PUBLISHED'" class="rc-alert" role="note">
        Artikel ini tidak bisa diubah saat berstatus {{ meta?.label }}.
      </p>
      <p v-if="saveState === 'failed' && saveError" class="rc-alert rc-alert--error" role="alert">{{ saveError }}</p>
      <p v-if="actionError" class="rc-alert rc-alert--error" role="alert">{{ actionError }}</p>

      <StudioWriter v-model:title="form.title" v-model:subtitle="form.subtitle" v-model:body="form.body" :disabled="!editable" />

      <div class="rc-editor-meta">
        <label class="rc-label">
          Akses
          <select v-model="form.accessType" class="rc-field" :disabled="!editable">
            <option value="FREE">Gratis, perlu masuk untuk membaca</option>
            <option value="PAID">Berbayar, pembaca melihat pratinjau dulu</option>
          </select>
        </label>
        <label v-if="form.accessType === 'PAID'" class="rc-label">
          Harga (Rp)
          <input v-model.number="form.price" type="number" min="1" step="1" class="rc-field" :disabled="!editable" />
        </label>
      </div>
    </template>
  </div>
</template>
