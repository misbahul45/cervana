<script setup lang="ts">
import { ref } from 'vue';
import { sandboxApi } from '~/lib/api';
import type { PlacementResult, DiagnosticQuestion } from '~/interfaces/sandbox';

const questions: DiagnosticQuestion[] = [
  { id: 'q1', level: 1, prompt: 'Aset = Liabilitas + ...', options: ['Ekuitas', 'Pendapatan', 'Beban'] },
  { id: 'q2', level: 2, prompt: 'Persediaan dinilai dengan ...', options: ['FIFO', 'LIFO', 'Average'] },
  { id: 'q3', level: 3, prompt: 'Variabel costing vs absorption costing adalah topik ...', options: ['Akuntansi Manajemen', 'Akuntansi Keuangan', 'Audit'] },
  { id: 'q4', level: 4, prompt: 'Konsolidasi laporan keuangan adalah topik ...', options: ['Akuntansi Keuangan Menengah', 'Akuntansi Keuangan Lanjutan', 'Audit'] },
  { id: 'q5', level: 4, prompt: 'Pajak tangguhan adalah topik ...', options: ['Pajak', 'Audit', 'Etika'] },
];

const answers = ref<string[]>(['', '', '', '', '']);
const result = ref<PlacementResult | null>(null);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

async function submit() {
  submitting.value = true;
  errorMessage.value = null;
  try {
    result.value = (await sandboxApi.placement(answers.value)) ?? null;
    if (!result.value) {
      errorMessage.value = 'Tidak dapat memproses diagnostik. Coba lagi nanti.';
    }
  } catch (err) {
    errorMessage.value = 'Tidak dapat menghubungi layanan diagnostik.';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Diagnostik Awal — ReduCera' });
</script>

<template>
  <main>
    <h1>Diagnostik Awal</h1>
    <form @submit.prevent="submit">
      <fieldset v-for="(q, i) in questions" :key="q.id">
        <legend>{{ q.prompt }}</legend>
        <label v-for="opt in q.options" :key="opt">
          <input type="radio" :name="q.id" :value="opt" v-model="answers[i]" />
          {{ opt }}
        </label>
      </fieldset>
      <button type="submit" :disabled="submitting || answers.some((a) => !a)">
        {{ submitting ? 'Mengirim…' : 'Lihat Rekomendasi' }}
      </button>
    </form>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <section v-if="result">
      <h2>Anda cocok untuk Level {{ result.recommendedLevel }}</h2>
      <p>Topik awal: {{ result.topicId }}</p>
    </section>
  </main>
</template>