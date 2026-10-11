<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import type { DiagnosticQuestion, PlacementResult } from '~/interfaces/sandbox';
import { sandboxApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Diagnostik Awal — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Diagnostik Awal — ReduCera' });

const questions: DiagnosticQuestion[] = [
  { id: 'q1', level: 1, prompt: 'Aset = Liabilitas + ...', options: ['Ekuitas', 'Pendapatan', 'Beban'] },
  { id: 'q2', level: 2, prompt: 'Persediaan dinilai dengan ...', options: ['FIFO', 'LIFO', 'Average'] },
  { id: 'q3', level: 3, prompt: 'Variabel costing vs absorption costing adalah topik ...', options: ['Akuntansi Manajemen', 'Akuntansi Keuangan', 'Audit'] },
  { id: 'q4', level: 4, prompt: 'Konsolidasi laporan keuangan adalah topik ...', options: ['Akuntansi Keuangan Menengah', 'Akuntansi Keuangan Lanjutan', 'Audit'] },
  { id: 'q5', level: 4, prompt: 'Pajak tangguhan adalah topik ...', options: ['Pajak', 'Audit', 'Etika'] },
];

const answers = ref<string[]>(questions.map(() => ''));
const result = ref<PlacementResult | null>(null);
const submitting = ref(false);
const problem = ref<string | null>(null);

const complete = computed(() => answers.value.every(Boolean));

async function submit() {
  if (submitting.value || !complete.value) return;
  submitting.value = true;
  problem.value = null;
  try {
    result.value = (await sandboxApi.placement(answers.value)) ?? null;
    if (!result.value) problem.value = 'Diagnostik tidak mengembalikan hasil. Coba lagi nanti.';
  } catch (err) {
    problem.value = describeApiError(err, 'Tidak dapat menghubungi layanan diagnostik.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="rc-stack rc-pay">
    <PageHeader title="Diagnostik awal" subtitle="Jawab lima pertanyaan singkat untuk menentukan titik mulai belajarmu." />

    <PlayCard as="form" class="rc-studio-form" aria-label="Diagnostik" novalidate @submit.prevent="submit">
      <fieldset v-for="(question, index) in questions" :key="question.id" class="rc-diag__question">
        <legend class="rc-diag__prompt">{{ index + 1 }}. {{ question.prompt }}</legend>
        <label v-for="option in question.options" :key="option" class="rc-check">
          <input v-model="answers[index]" type="radio" :name="question.id" :value="option" />
          {{ option }}
        </label>
      </fieldset>
      <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>
      <div class="rc-actions">
        <PlayButton type="submit" :disabled="!complete" :loading="submitting">Lihat rekomendasi</PlayButton>
      </div>
    </PlayCard>

    <PlayCard v-if="result" tone="success" as="section" aria-labelledby="diag-result" role="status">
      <h2 id="diag-result" class="rc-h2">Kamu cocok mulai di level {{ result.recommendedLevel }}</h2>
      <div class="rc-actions">
        <PlayButton to="/learn/topics">Pilih topik</PlayButton>
      </div>
    </PlayCard>
  </div>
</template>
