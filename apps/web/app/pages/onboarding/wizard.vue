<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Form from '~/components/ui/Form.vue';
import { creatorApi } from '~/lib/api';

const router = useRouter();
const step = ref(1);

const form = reactive({
  fullName: '',
  bio: '',
  topics: [] as string[],
  learningStyle: 'visual',
  pace: 'normal',
});

const submitting = ref(false);
const error = ref('');

onMounted(() => {
  const cached = localStorage.getItem('onboarding-data');
  if (cached) {
    try {
      Object.assign(form, JSON.parse(cached));
      const idx = localStorage.getItem('onboarding-step');
      if (idx) step.value = Number(idx);
    } catch {
      // ignore
    }
  }
});

function persist() {
  try {
    localStorage.setItem('onboarding-data', JSON.stringify(form));
    localStorage.setItem('onboarding-step', String(step.value));
  } catch {
    // ignore
  }
}

function next() {
  step.value += 1;
  persist();
}

function back() {
  step.value = Math.max(1, step.value - 1);
  persist();
}

async function finish() {
  if (!form.fullName) {
    error.value = 'Nama wajib diisi';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    try {
      await creatorApi.apply?.({
        fullName: form.fullName,
        bio: form.bio,
        expertise: (form.topics || []).join(','),
        experiences: [],
        certifications: [],
      });
    } catch {
      // local-only save if api unavailable
    }
    persist();
    await router.push('/onboarding/complete');
  } finally {
    submitting.value = false;
  }
}

function fieldset1() {
  return [
    { name: 'fullName', label: 'Nama Lengkap', type: 'text', required: true },
    { name: 'bio', label: 'Bio Singkat', type: 'text' },
  ];
}

function fieldset2() {
  return [
    {
      name: 'learningStyle',
      label: 'Gaya Belajar',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'visual', label: 'Visual' },
        { value: 'auditory', label: 'Auditori' },
        { value: 'kinesthetic', label: 'Kinestetik' },
      ],
    },
    {
      name: 'pace',
      label: 'Tempo Belajar',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'slow', label: 'Santai' },
        { value: 'normal', label: 'Normal' },
        { value: 'fast', label: 'Cepat' },
      ],
    },
  ];
}
</script>

<template>
  <main class="max-w-2xl mx-auto p-6">
    <div class="flex items-center gap-2 mb-4">
      <div v-for="n in 3" :key="n" :class="['flex-1 h-1 rounded', n <= step ? 'bg-[var(--rc-primary,#3b82f6)]' : 'bg-[var(--rc-bg-elevated,#e5e7eb)]']" />
    </div>
    <p class="text-xs text-[var(--rc-fg-muted,#6b7280)] mb-6">Langkah {{ step }} dari 3</p>

    <div v-if="step === 1">
      <h1 class="text-3xl font-bold mb-2">Selamat Datang di ReduCera</h1>
      <p class="text-[var(--rc-fg-muted,#6b7280)] mb-6">Beritahu kami tentang diri Anda untuk pengalaman belajar yang dipersonalisasi.</p>
      <Form :fields="fieldset1()" @submit="(d) => Object.assign(form, d) && next()" submit-label="Lanjut" />
    </div>

    <div v-else-if="step === 2">
      <h1 class="text-3xl font-bold mb-2">Preferensi Belajar</h1>
      <p class="text-[var(--rc-fg-muted,#6b7280)] mb-6">Bantu kami memilih format materi yang paling cocok.</p>
      <Form :fields="fieldset2()" @submit="(d) => Object.assign(form, d) && next()" submit-label="Lanjut" />
    </div>

    <div v-else-if="step === 3">
      <h1 class="text-3xl font-bold mb-2">Topik Peminatan</h1>
      <p class="text-[var(--rc-fg-muted,#6b7280)] mb-6">Pilih topik akuntansi yang ingin Anda pelajari (bisa multi-pilih).</p>
      <div class="grid grid-cols-2 gap-2">
        <label v-for="t in ['l1-t01-accounting-equation', 'l1-t02-debits-credits', 'l2-t01-balance-sheet', 'l2-t02-income-statement', 'l3-t01-cost-classification']" :key="t" class="flex items-center gap-2 p-2 rounded border border-[var(--rc-border)]">
          <input type="checkbox" :value="t" v-model="form.topics" />
          <span class="text-sm">{{ t }}</span>
        </label>
      </div>
      <div v-if="error" class="mt-3 bg-red-50 text-red-700 px-3 py-2 rounded">{{ error }}</div>
      <div class="flex gap-3 mt-4">
        <button type="button" class="px-4 py-2 rounded border" @click="back">Kembali</button>
        <button type="button" class="px-4 py-2 rounded bg-[var(--rc-primary,#3b82f6)] text-white font-medium" :disabled="submitting" @click="finish">
          {{ submitting ? 'Menyimpan...' : 'Selesaikan' }}
        </button>
      </div>
    </div>
  </main>
</template>