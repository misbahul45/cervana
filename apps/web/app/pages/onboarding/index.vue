<script setup lang="ts">
import { ref, computed } from 'vue';

definePageMeta({
  title: 'Onboarding — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

type Step = 'goal' | 'level' | 'diagnostic' | 'result';

const step = ref<Step>('goal');
const goal = ref('');
const level = ref<'beginner' | 'intermediate' | 'advanced' | null>(null);
const diagnosticAnswers = ref<Record<string, number>>({});
const diagnosticResult = ref<{ recommendedPath: string; level: string } | null>(null);

const diagnosticQuestions = [
  {
    id: 'q1',
    text: 'Apa persamaan dasar akuntansi?',
    options: ['A = L + E', 'P - L = E', 'A + L = E', 'Tidak tahu'],
    correct: 0,
  },
  {
    id: 'q2',
    text: 'Normal balance akun aset adalah...',
    options: ['Debit', 'Credit', 'Tidak punya', 'Tergantung transaksi'],
    correct: 0,
  },
  {
    id: 'q3',
    text: 'Jurnal umum harus seimbang antara...',
    options: ['Debit dan Credit', 'Aset dan Liabilitas', 'Pendapatan dan Beban', 'Kas dan Piutang'],
    correct: 0,
  },
];

const stepIndex = computed(() => ({ goal: 0, level: 1, diagnostic: 2, result: 3 }[step.value]));
const totalSteps = 4;
const percent = computed(() => Math.round(((stepIndex.value + 1) / totalSteps) * 100));

function pickGoal(g: string) {
  goal.value = g;
  step.value = 'level';
}
function pickLevel(l: 'beginner' | 'intermediate' | 'advanced') {
  level.value = l;
  step.value = 'diagnostic';
}
function answer(qid: string, idx: number) {
  diagnosticAnswers.value[qid] = idx;
}
function submitDiagnostic() {
  const correct = diagnosticQuestions.filter(q => diagnosticAnswers.value[q.id] === q.correct).length;
  const ratio = correct / diagnosticQuestions.length;
  diagnosticResult.value = {
    recommendedPath: ratio >= 0.66 ? 'Dasar → Menengah → Lanjutan' : 'Dasar (Dipercepat)',
    level: ratio >= 0.66 ? level.value || 'beginner' : 'beginner',
  };
  step.value = 'result';
}
function goToPath() {
  navigateTo('/learn/path');
}
</script>

<template>
  <main id="main" aria-labelledby="onboarding-heading">
    <h1 id="onboarding-heading" class="rc-onboarding__title">Selamat Datang di ReduCera</h1>
    <p class="rc-onboarding__intro">
      Mari mulai dengan mendiagnosis kemampuan akuntansi Anda sehingga kami dapat menempatkan Anda di jalur yang tepat.
    </p>
    <ol class="rc-onboarding__steps" aria-label="Langkah onboarding">
      <li :aria-current="stepIndex === 0 ? 'step' : null">Tujuan</li>
      <li :aria-current="stepIndex === 1 ? 'step' : null">Level</li>
      <li :aria-current="stepIndex === 2 ? 'step' : null">Diagnostik</li>
      <li :aria-current="stepIndex === 3 ? 'step' : null">Hasil</li>
    </ol>
    <progress :value="percent" max="100" :aria-label="`Progress onboarding ${percent}%`" />

    <section v-if="step === 'goal'" class="rc-onboarding__panel" aria-labelledby="goal-heading">
      <h2 id="goal-heading">Apa tujuan utama Anda?</h2>
      <p>Pilih salah satu agar kami dapat menyusun jalur belajar yang sesuai.</p>
      <div class="rc-onboarding__choices">
        <button type="button" @click="pickGoal('memperkuat-dasar')">Memperkuat dasar</button>
        <button type="button" @click="pickGoal('menyiapkan-ujian')">Menyiapkan ujian</button>
        <button type="button" @click="pickGoal('naik-level')">Naik level ke lanjutan</button>
        <button type="button" @click="pickGoal('membangun-bisnis')">Membangun praktik bisnis</button>
      </div>
      <p class="rc-onboarding__selected">Terpilih: <strong>{{ goal || 'belum dipilih' }}</strong></p>
    </section>

    <section v-else-if="step === 'level'" class="rc-onboarding__panel" aria-labelledby="level-heading">
      <h2 id="level-heading">Bagaimana level Anda saat ini?</h2>
      <p>Level akan mengarahkan diagnosa lebih lanjut.</p>
      <div class="rc-onboarding__choices">
        <button type="button" @click="pickLevel('beginner')">Pemula</button>
        <button type="button" @click="pickLevel('intermediate')">Menengah</button>
        <button type="button" @click="pickLevel('advanced')">Lanjutan</button>
      </div>
    </section>

    <section v-else-if="step === 'diagnostic'" class="rc-onboarding__panel" aria-labelledby="diagnostic-heading">
      <h2 id="diagnostic-heading">Diagnostik cepat</h2>
      <p>Jawab 3 pertanyaan ini. Tidak ada nilai benar/salah; ini hanya untuk menempatkan Anda.</p>
      <form @submit.prevent="submitDiagnostic" class="rc-onboarding__diagnostic">
        <fieldset v-for="q in diagnosticQuestions" :key="q.id">
          <legend>{{ q.text }}</legend>
          <label v-for="(opt, i) in q.options" :key="i">
            <input
              type="radio"
              :name="q.id"
              :value="i"
              :checked="diagnosticAnswers[q.id] === i"
              @change="answer(q.id, i)"
            />
            <span>{{ opt }}</span>
          </label>
        </fieldset>
        <button type="submit" :disabled="Object.keys(diagnosticAnswers).length < diagnosticQuestions.length">
          Selesaikan diagnosa
        </button>
      </form>
    </section>

    <section v-else-if="step === 'result'" class="rc-onboarding__panel" aria-labelledby="result-heading">
      <h2 id="result-heading">Anda ditempatkan di</h2>
      <p v-if="diagnosticResult">
        Jalur yang direkomendasikan: <strong>{{ diagnosticResult.recommendedPath }}</strong>
      </p>
      <p>Sekarang ReduCera dapat menyusun aktivitas yang sesuai untuk Anda.</p>
      <button type="button" @click="goToPath">Buka peta keterampilan</button>
    </section>
  </main>
</template>

<style scoped>
.rc-onboarding__title { font-size: 1.5rem; font-weight: 700; }
.rc-onboarding__intro { color: var(--ui-text-muted); margin: 0.5rem 0 1.5rem; }
.rc-onboarding__steps {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;
}
.rc-onboarding__steps li {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: var(--ui-bg-muted, #f3f4f6);
  font-size: 0.75rem;
}
.rc-onboarding__steps li[aria-current='step'] {
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
}
progress { width: 100%; height: 0.5rem; margin-bottom: 1rem; }
.rc-onboarding__panel {
  padding: 1.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 1rem;
  background: var(--ui-bg, white);
}
.rc-onboarding__choices {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 1rem 0;
}
.rc-onboarding__choices button {
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.rc-onboarding__choices button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.rc-onboarding__selected { color: var(--ui-text-muted); }
.rc-onboarding__diagnostic fieldset {
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.625rem;
  padding: 1rem;
  margin-bottom: 1rem;
}
.rc-onboarding__diagnostic legend { font-weight: 600; margin-bottom: 0.5rem; }
.rc-onboarding__diagnostic label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
button[type="submit"] {
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  border: 0;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  font-weight: 600;
  cursor: pointer;
}
button[type="submit"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>