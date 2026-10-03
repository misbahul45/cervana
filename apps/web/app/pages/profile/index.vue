<script setup lang="ts">
import { ref, onMounted } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';
import Form from '~/components/ui/Form.vue';
import { personalizationApi } from '~/lib/api';

const mastery = ref<Array<{ topicId: string; score: number }>>([]);
const loading = ref(true);

const form = ref({ name: '', email: '', bio: '' });

onMounted(async () => {
  try {
    const raw = localStorage.getItem('profile-cache');
    if (raw) Object.assign(form.value, JSON.parse(raw));
    mastery.value = (await personalizationApi.listMastery()) as any;
  } catch {
    mastery.value = [];
  } finally {
    loading.value = false;
  }
});

function save() {
  localStorage.setItem('profile-cache', JSON.stringify(form.value));
  alert('Profil tersimpan');
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Profil & Pengaturan</h1>

    <div v-if="loading" class="text-center py-8">Memuat...</div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Topik Dipelajari" :value="mastery.length" />
        <StatCard title="Rata-rata Penguasaan" :value="mastery.length ? Math.round(mastery.reduce((s, m) => s + m.score, 0) / mastery.length * 100) : 0" suffix="%" />
        <StatCard title="Peringkat Anda" :value="Math.max(1, Math.ceil(mastery.length / 5))" />
      </div>

      <Form
        :fields="[
          { name: 'name', label: 'Nama Lengkap', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'bio', label: 'Bio', type: 'text' },
        ]"
        @submit="(d) => Object.assign(form, d) && save()"
        submit-label="Simpan"
      />
    </template>
  </main>
</template>