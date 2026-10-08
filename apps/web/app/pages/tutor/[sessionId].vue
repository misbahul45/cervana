<script setup lang="ts">
import { ref } from 'vue';
import { useMutation } from '@tanstack/vue-query';

definePageMeta({
  title: 'Tutor AI — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const route = useRoute();
const sessionId = computed(() => String(route.params.sessionId || ''));

const question = ref('');
const step = ref<'idle' | 'confirm' | 'pending' | 'streaming' | 'completed' | 'error' | 'insufficient' | 'no-grounding'>('idle');
const errorMessage = ref<string>('');
const answer = ref<any>(null);

const creditCost = ref(2);

const ask = useMutation({
  mutationFn: async (q: string) => {
    return {
      explanation:
        'Σ debit harus sama dengan Σ credit. Akun aset bertambah dengan debit, berkurang dengan credit. Akun liabilitas/ekuitas/pendapatan bertambah dengan credit.',
      examples: [
        'Membeli peralatan Rp 5.000.000 tunai → Debit Aset Tetap 5.000.000; Credit Kas 5.000.000',
      ],
      steps: [
        'Identifikasi akun yang terpengaruh',
        'Tentukan normal balance tiap akun',
        'Posting debit dan credit dengan jumlah yang sama',
      ],
      citations: [
        {
          source: 'Modul Double-Entry',
          snippet: 'Σ debits == Σ credits',
          lessonId: 'lesson-double-entry',
        },
      ],
      nextAction: 'Coba satu skenario di Sandbox Akuntansi.',
    };
  },
  onSuccess: (data) => {
    answer.value = data;
    step.value = 'completed';
  },
  onError: (err: any) => {
    errorMessage.value = err?.message || 'Gagal menghubungi tutor.';
    if (err?.code === 'INSUFFICIENT_AI_CREDITS') step.value = 'insufficient';
    else if (err?.code === 'GROUNDING_EMPTY') step.value = 'no-grounding';
    else if (err?.code === 'TIMEOUT') step.value = 'no-grounding';
    else step.value = 'error';
  },
});

function startConfirm() {
  if (!question.value.trim()) return;
  step.value = 'confirm';
}
function proceed() {
  step.value = 'pending';
  ask.mutate(question.value);
}
function cancel() {
  step.value = 'idle';
}
function reset() {
  step.value = 'idle';
  question.value = '';
  answer.value = null;
  errorMessage.value = '';
}
</script>

<template>
  <main id="main" aria-labelledby="tutor-heading">
    <header class="rc-tutor-page__header">
      <h1 id="tutor-heading">Tutor AI</h1>
      <p class="rc-tutor-page__ai-label">
        <UIcon name="i-lucide-sparkles" aria-hidden="true" />
        Dijawab oleh AI.
      </p>
    </header>

    <TutorStatus :state="step" :error-message="errorMessage" />

    <section
      v-if="step === 'idle' || step === 'completed' || step === 'error'"
      class="rc-tutor-page__composer"
    >
      <label for="tutor-question" class="sr-only">Pertanyaan untuk tutor</label>
      <textarea
        id="tutor-question"
        v-model="question"
        rows="4"
        class="placeholder-always-soft"
        placeholder="Tulis pertanyaan akuntansi Anda..."
      />
      <p class="rc-tutor-page__cost">
        Biaya: <strong>{{ creditCost }} kredit</strong>
      </p>
      <button
        type="button"
        class="rc-tutor-page__send"
        :disabled="!question.trim()"
        @click="startConfirm"
      >
        Kirim
      </button>
    </section>

    <CreditCostConfirm
      v-if="step === 'confirm'"
      :cost="creditCost"
      :question="question"
      @confirm="proceed"
      @cancel="cancel"
    />

    <LoadingSkeleton
      v-if="step === 'pending'"
      variant="panel"
      :count="3"
    />

    <TutorMessage
      v-if="answer"
      :answer="answer"
      personalized-hint="Petunjuk ini dirancang untuk memperkuat konsep double-entry sesuai jalur belajar Anda."
    />

    <button
      v-if="step === 'completed' || step === 'error'"
      type="button"
      class="rc-tutor-page__reset"
      @click="reset"
    >
      Tanya lagi
    </button>

    <InsufficientCreditsState
      v-if="step === 'insufficient'"
      :cost="creditCost"
    />

    <ErrorState
      v-if="step === 'no-grounding'"
      title="Materi yang relevan belum ditemukan"
      message="Tutor tidak dapat menemukan cukup materi di kurikulum untuk menjawab ini. Coba persempit pertanyaan atau gunakan istilah kurikulum."
    />
  </main>
</template>

<style scoped>
.rc-tutor-page__header { margin-bottom: 1rem; }
.rc-tutor-page__header h1 { font-size: 1.5rem; font-weight: 700; }
.rc-tutor-page__ai-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-tutor-page__composer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}
.rc-tutor-page__composer textarea {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
}
.rc-tutor-page__cost {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-tutor-page__send {
  align-self: flex-start;
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
.rc-tutor-page__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rc-tutor-page__reset {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>