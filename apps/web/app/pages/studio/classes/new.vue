<script setup lang="ts">
import { creatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Kelas Baru — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const form = reactive({
  title: '',
  description: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
  format: 'LIVE',
  difficulty: 'BEGINNER',
  durationMinutes: 60,
  capacity: 20,
});

const sessions = ref<{ startsAt: string; endsAt: string }[]>([]);
const submitting = ref(false);
const error = ref('');

function addSession() {
  sessions.value.push({ startsAt: '', endsAt: '' });
}

function removeSession(index: number) {
  sessions.value.splice(index, 1);
}

async function save() {
  if (submitting.value) return;
  if (!form.title.trim()) {
    error.value = 'Judul wajib diisi.';
    return;
  }
  if (form.accessType === 'PAID' && (!form.price || form.price <= 0)) {
    error.value = 'Kelas berbayar harus memiliki harga.';
    return;
  }
  if (sessions.value.some((s) => !s.startsAt || !s.endsAt || new Date(s.endsAt) <= new Date(s.startsAt))) {
    error.value = 'Setiap sesi harus memiliki waktu mulai dan selesai yang valid.';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const created = await creatorApi.createClass({
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      accessType: form.accessType,
      ...(form.accessType === 'PAID' ? { price: form.price as number } : {}),
      format: form.format,
      difficulty: form.difficulty,
      durationMinutes: Number(form.durationMinutes),
      capacity: Number(form.capacity),
    });
    for (const session of sessions.value) {
      await creatorApi.addClassSession(created.id, {
        startsAt: new Date(session.startsAt).toISOString(),
        endsAt: new Date(session.endsAt).toISOString(),
      });
    }
    await navigateTo('/studio/classes');
  } catch (e) {
    error.value = describeApiError(e, 'Gagal menyimpan kelas.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Kelas Baru</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Disimpan sebagai draf. Kelas terbit setelah ditinjau dan disetujui.</p>

    <p v-if="error" role="alert" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</p>

    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="block font-medium mb-1" for="title">Judul Kelas</label>
        <input id="title" v-model="form.title" required minlength="3" maxlength="160" class="rc-field" />
      </div>
      <div>
        <label class="block font-medium mb-1" for="description">Deskripsi</label>
        <textarea id="description" v-model="form.description" rows="3" maxlength="20000" class="rc-field" />
      </div>
      <div class="flex flex-wrap gap-4">
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
        <div>
          <label class="block font-medium mb-1" for="format">Format</label>
          <select id="format" v-model="form.format" class="rc-field">
            <option value="LIVE">Live</option>
            <option value="RECORDED">Rekaman</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <div>
          <label class="block font-medium mb-1" for="difficulty">Tingkat</label>
          <select id="difficulty" v-model="form.difficulty" class="rc-field">
            <option value="BEGINNER">Pemula</option>
            <option value="INTERMEDIATE">Menengah</option>
            <option value="ADVANCED">Lanjut</option>
          </select>
        </div>
        <div>
          <label class="block font-medium mb-1" for="duration">Durasi (menit)</label>
          <input id="duration" v-model.number="form.durationMinutes" type="number" min="5" max="6000" required class="rc-field" />
        </div>
        <div>
          <label class="block font-medium mb-1" for="capacity">Kapasitas</label>
          <input id="capacity" v-model.number="form.capacity" type="number" min="1" required class="rc-field" />
        </div>
      </div>

      <fieldset>
        <legend class="block font-medium mb-2">Sesi ({{ sessions.length }})</legend>
        <div v-for="(s, i) in sessions" :key="i" class="flex gap-2 mb-2">
          <input v-model="s.startsAt" type="datetime-local" :aria-label="`Mulai sesi ${i + 1}`" class="rc-field" />
          <input v-model="s.endsAt" type="datetime-local" :aria-label="`Selesai sesi ${i + 1}`" class="rc-field" />
          <button type="button" class="rc-btn rc-btn--sm rc-btn--outline" :aria-label="`Hapus sesi ${i + 1}`" @click="removeSession(i)">×</button>
        </div>
        <button type="button" class="rc-btn rc-btn--sm rc-btn--outline" @click="addSession">+ Tambah sesi</button>
      </fieldset>

      <button type="submit" :disabled="submitting" class="rc-btn">
        {{ submitting ? 'Menyimpan…' : 'Simpan draf' }}
      </button>
    </form>
  </main>
</template>
