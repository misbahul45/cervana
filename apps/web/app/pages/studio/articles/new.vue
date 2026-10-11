<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import StudioWriter from '~/components/studio/StudioWriter.vue';
import { creatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { articlePayload, articleProblem } from '~/lib/studio';

definePageMeta({
  title: 'Artikel Baru — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Artikel Baru — ReduCera Studio' });

const form = reactive({
  title: '',
  subtitle: '',
  body: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
});

const saving = ref(false);
const error = ref('');

async function save() {
  if (saving.value) return;
  const problem = articleProblem(form);
  if (problem) {
    error.value = problem;
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const payload = articlePayload(form);
    const created = await creatorApi.create({
      title: payload.title,
      content: payload.content,
      accessType: payload.accessType,
      ...(payload.excerpt ? { excerpt: payload.excerpt } : {}),
      ...('price' in payload ? { price: payload.price } : {}),
    });
    await navigateTo(`/studio/articles/${created.id}`);
  } catch (err) {
    error.value = describeApiError(err, 'Artikel gagal disimpan.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="rc-stack">
    <h1 class="sr-only">Artikel baru</h1>
    <div class="rc-editor-head">
      <PlayButton to="/studio/articles" variant="ghost" size="sm">Kembali ke daftar</PlayButton>
      <PlayButton :loading="saving" @click="save">Simpan draf</PlayButton>
    </div>

    <p v-if="error" class="rc-alert rc-alert--error" role="alert">{{ error }}</p>

    <StudioWriter v-model:title="form.title" v-model:subtitle="form.subtitle" v-model:body="form.body" />

    <div class="rc-editor-meta">
      <label class="rc-label">
        Akses
        <select v-model="form.accessType" class="rc-field">
          <option value="FREE">Gratis, perlu masuk untuk membaca</option>
          <option value="PAID">Berbayar, pembaca melihat pratinjau dulu</option>
        </select>
      </label>
      <label v-if="form.accessType === 'PAID'" class="rc-label">
        Harga (Rp)
        <input v-model.number="form.price" type="number" min="1" step="1" class="rc-field" />
      </label>
    </div>
    <p class="rc-hint">Disimpan sebagai draf. Artikel terbit setelah kamu mengirimnya dan admin menyetujui.</p>
  </div>
</template>
