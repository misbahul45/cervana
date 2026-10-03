<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MarkdownEditor from '~/components/editor/MarkdownEditor.vue';
import Form from '~/components/ui/Form.vue';
import { creatorApi } from '~/lib/api';

const route = useRoute();
const router = useRouter();

const form = reactive({
  title: '',
  topicId: '',
  body: '',
  coverImage: '',
  tags: '',
  visibility: 'PUBLIC',
});

const submitting = ref(false);
const error = ref('');
const savedAt = ref<Date | null>(null);

onMounted(() => {
  const editId = String(route.params.id || '');
  if (editId) {
    try {
      const raw = localStorage.getItem(`article-draft-${editId}`);
      if (raw) Object.assign(form, JSON.parse(raw));
    } catch {
      // ignore
    }
  }
});

function autosave() {
  try {
    localStorage.setItem('article-draft-new', JSON.stringify(form));
  } catch {
    // ignore
  }
  savedAt.value = new Date();
}

async function save() {
  if (!form.title || !form.body) {
    error.value = 'Judul dan isi wajib diisi';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
    const created = await creatorApi.create({
      title: form.title,
      body: form.body,
      topicId: form.topicId,
      coverImage: form.coverImage || undefined,
      tags,
    });
    if (created?.id) {
      autosave();
      await router.push('/studio/articles');
    }
  } catch (e: any) {
    error.value = e?.data?.message || 'Gagal menyimpan artikel';
  } finally {
    submitting.value = false;
  }
}

function fields() {
  return [
    { name: 'title', label: 'Judul', type: 'text', required: true },
    { name: 'topicId', label: 'Topik (contoh: l1-t01-accounting-equation)', type: 'text', required: true },
    { name: 'coverImage', label: 'URL Sampul (opsional)', type: 'text' },
    { name: 'tags', label: 'Tag (pisahkan dengan koma)', type: 'text' },
  ];
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Artikel Baru</h1>
      <span v-if="savedAt" class="text-xs text-[var(--rc-fg-muted,#6b7280)]">Disimpan otomatis {{ savedAt.toLocaleTimeString() }}</span>
    </div>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Editor markdown dengan autosave. Diterbitkan setelah disetujui reviewer.</p>

    <div v-if="error" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</div>

    <Form :fields="fields()" @submit="(d) => Object.assign(form, d) && save()" submit-label="Simpan" />

    <div>
      <label class="block font-medium mb-1">Isi Artikel (Markdown)</label>
      <MarkdownEditor v-model="form.body" placeholder="# Judul Bagian\n\nTulis artikel Anda di sini. Mendukung **bold**, *italic*, [link](url), dan ```kode```." @save="save" @cancel="router.push('/studio/articles')" />
    </div>
  </main>
</template>