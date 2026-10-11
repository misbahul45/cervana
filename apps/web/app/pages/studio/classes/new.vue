<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import { creatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { classProblem } from '~/lib/studio';

definePageMeta({
  title: 'Kelas Baru — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Kelas Baru — ReduCera Studio' });

const form = reactive({
  title: '',
  description: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
  format: 'LIVE',
  difficulty: 'BEGINNER',
  durationMinutes: 60 as number | null,
  capacity: 20 as number | null,
});

const saving = ref(false);
const error = ref('');

async function save() {
  if (saving.value) return;
  const problem = classProblem(form);
  if (problem) {
    error.value = problem;
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const created = await creatorApi.createClass({
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      accessType: form.accessType,
      ...(form.accessType === 'PAID' ? { price: form.price as number } : {}),
      format: form.format,
      difficulty: form.difficulty,
      ...(form.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
      ...(form.capacity ? { capacity: Number(form.capacity) } : {}),
    });
    await navigateTo(`/studio/classes/${created.id}`);
  } catch (err) {
    error.value = describeApiError(err, 'Kelas gagal disimpan.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Kelas baru" subtitle="Disimpan sebagai draf. Jadwal sesi diatur setelah kelas dibuat." />

    <PlayCard as="form" class="rc-studio-form" novalidate @submit.prevent="save">
      <label class="rc-label">
        Judul kelas
        <input v-model="form.title" required minlength="3" maxlength="160" class="rc-field" />
      </label>
      <label class="rc-label">
        Deskripsi
        <textarea v-model="form.description" rows="5" maxlength="20000" class="rc-field" />
      </label>
      <div class="rc-studio-form__row">
        <label class="rc-label">
          Akses
          <select v-model="form.accessType" class="rc-field">
            <option value="FREE">Gratis</option>
            <option value="PAID">Berbayar</option>
          </select>
        </label>
        <label v-if="form.accessType === 'PAID'" class="rc-label">
          Harga (Rp)
          <input v-model.number="form.price" type="number" min="1" step="1" class="rc-field" />
        </label>
        <label class="rc-label">
          Format
          <select v-model="form.format" class="rc-field">
            <option value="LIVE">Live</option>
            <option value="RECORDED">Rekaman</option>
            <option value="HYBRID">Hibrida</option>
          </select>
        </label>
        <label class="rc-label">
          Tingkat
          <select v-model="form.difficulty" class="rc-field">
            <option value="BEGINNER">Pemula</option>
            <option value="INTERMEDIATE">Menengah</option>
            <option value="ADVANCED">Mahir</option>
          </select>
        </label>
        <label class="rc-label">
          Durasi (menit)
          <input v-model.number="form.durationMinutes" type="number" min="5" max="6000" class="rc-field" />
        </label>
        <label class="rc-label">
          Kapasitas peserta
          <input v-model.number="form.capacity" type="number" min="1" class="rc-field" />
        </label>
      </div>
      <p v-if="error" class="rc-alert rc-alert--error" role="alert">{{ error }}</p>
      <div class="rc-actions">
        <PlayButton type="submit" :loading="saving">Simpan draf</PlayButton>
        <PlayButton to="/studio/classes" variant="secondary">Batal</PlayButton>
      </div>
    </PlayCard>
  </div>
</template>
