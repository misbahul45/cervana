<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import Form from '~/components/ui/Form.vue';
import JsonEditor from '~/components/editor/JsonEditor.vue';
import { creatorApi } from '~/lib/api';

const router = useRouter();

const form = reactive({
  title: '',
  description: '',
  topicId: '',
  price: 50000,
  format: 'LIVE',
  difficulty: 'BEGINNER',
  durationMinutes: 60,
  capacity: 20,
  sessions: [] as Array<{ title: string; scheduledAt: string }>,
});

const sessions = ref<{ title: string; scheduledAt: string }[]>([]);
const submitting = ref(false);
const error = ref('');

function addSession() {
  sessions.value.push({ title: '', scheduledAt: '' });
}

function removeSession(i: number) {
  sessions.value.splice(i, 1);
}

async function save() {
  if (!form.title || !form.topicId) {
    error.value = 'Judul dan topik wajib diisi';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const created = await creatorApi.createClass({
      title: form.title,
      description: form.description,
      topicId: form.topicId,
      price: Number(form.price),
      format: form.format as 'LIVE' | 'RECORDED' | 'HYBRID',
      difficulty: form.difficulty as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
      durationMinutes: Number(form.durationMinutes),
      capacity: Number(form.capacity),
      sessions: sessions.value,
    });
    if (created?.id) {
      await router.push('/studio/classes');
    }
  } catch (e: any) {
    error.value = e?.data?.message || 'Gagal menyimpan kelas';
  } finally {
    submitting.value = false;
  }
}

function fields() {
  return [
    { name: 'title', label: 'Judul Kelas', type: 'text', required: true },
    { name: 'description', label: 'Deskripsi', type: 'text' },
    { name: 'topicId', label: 'Topik (contoh: l2-t01-balance-sheet)', type: 'text', required: true },
    { name: 'price', label: 'Harga (IDR)', type: 'number', required: true },
    { name: 'durationMinutes', label: 'Durasi (menit)', type: 'number', required: true },
    { name: 'capacity', label: 'Kapasitas Peserta', type: 'number', required: true },
  ];
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Kelas Baru</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Buat kelas live atau recorded dengan beberapa sesi.</p>

    <div v-if="error" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</div>

    <Form :fields="fields()" @submit="(d) => Object.assign(form, d) && save()" submit-label="Simpan" />

    <div>
      <label class="block font-medium mb-2">Sesi ({{ sessions.length }})</label>
      <div v-for="(s, i) in sessions" :key="i" class="flex gap-2 mb-2">
        <input v-model="s.title" placeholder="Judul sesi" class="flex-1 px-3 py-2 rounded border border-[var(--rc-border)]" />
        <input v-model="s.scheduledAt" type="datetime-local" class="px-3 py-2 rounded border border-[var(--rc-border)]" />
        <button type="button" class="px-3 py-2 text-red-600" @click="removeSession(i)">×</button>
      </div>
      <button type="button" class="text-sm text-[var(--rc-primary,#3b82f6)]" @click="addSession">+ Tambah sesi</button>
    </div>
  </main>
</template>