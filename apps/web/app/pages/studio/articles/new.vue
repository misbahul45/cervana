<script setup lang="ts">
import MarkdownEditor from '~/components/editor/MarkdownEditor.vue';
import { creatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Artikel Baru — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const form = reactive({
  title: '',
  excerpt: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
  content: '',
});

const submitting = ref(false);
const error = ref('');

async function save() {
  if (submitting.value) return;
  if (!form.title.trim() || !form.content.trim()) {
    error.value = 'Judul dan isi wajib diisi.';
    return;
  }
  if (form.accessType === 'PAID' && (!form.price || form.price <= 0)) {
    error.value = 'Artikel berbayar harus memiliki harga.';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    await creatorApi.create({
      title: form.title.trim(),
      content: form.content,
      ...(form.excerpt.trim() ? { excerpt: form.excerpt.trim() } : {}),
      accessType: form.accessType,
      ...(form.accessType === 'PAID' ? { price: form.price as number } : {}),
    });
    await navigateTo('/studio/articles');
  } catch (e) {
    error.value = describeApiError(e, 'Gagal menyimpan artikel.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Artikel Baru</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Disimpan sebagai draf. Artikel terbit setelah ditinjau dan disetujui.</p>

    <p v-if="error" role="alert" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</p>

    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="block font-medium mb-1" for="title">Judul</label>
        <input id="title" v-model="form.title" required minlength="3" maxlength="160" class="rc-field" />
      </div>
      <div>
        <label class="block font-medium mb-1" for="excerpt">Ringkasan (opsional)</label>
        <textarea id="excerpt" v-model="form.excerpt" maxlength="500" rows="2" class="rc-field" />
      </div>
      <div class="flex gap-4">
        <div>
          <label class="block font-medium mb-1" for="access">Akses</label>
          <select id="access" v-model="form.accessType" class="rc-field">
            <option value="FREE">Gratis</option>
            <option value="PAID">Berbayar</option>
          </select>
        </div>
        <div v-if="form.accessType === 'PAID'">
          <label class="block font-medium mb-1" for="price">Harga (IDR)</label>
          <input id="price" v-model.number="form.price" type="number" min="1" step="1" required class="rc-field" />
        </div>
      </div>
      <div>
        <label class="block font-medium mb-1">Isi Artikel (Markdown)</label>
        <MarkdownEditor v-model="form.content" placeholder="Tulis artikel Anda di sini." @save="save" @cancel="navigateTo('/studio/articles')" />
      </div>
      <button type="submit" :disabled="submitting" class="rc-btn">
        {{ submitting ? 'Menyimpan…' : 'Simpan draf' }}
      </button>
    </form>
  </main>
</template>
