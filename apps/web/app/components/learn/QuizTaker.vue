<script setup lang="ts">
import { ref, computed } from 'vue';
import Form from '~/components/ui/Form.vue';
import ActionButton from '~/components/ui/ActionButton.vue';

const props = defineProps<{
  questions: Array<{ id: string; prompt: string; options: string[]; correct: number }>;
  quizId: string;
}>();
const emit = defineEmits<{ submit: [{ quizId: string; score: number; total: number }] }>();

const answers = ref<Record<string, number>>({});
const submitted = ref(false);
const score = ref(0);

const total = computed(() => props.questions.length);
const correct = computed(() => props.questions.filter((q) => answers.value[q.id] === q.correct).length);

function submit() {
  submitted.value = true;
  score.value = correct.value;
  emit('submit', { quizId: props.quizId, score: score.value, total: total.value });
}

function fields() {
  return props.questions.map((q) => ({
    name: q.id,
    label: q.prompt,
    type: 'select' as const,
    required: true,
    options: q.options.map((o, i) => ({ value: String(i), label: o })),
  }));
}

function onSubmit(data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    answers.value[k] = Number(v);
  }
  submit();
}
</script>

<template>
  <div class="quiz-taker space-y-4">
    <div v-if="submitted" class="text-center py-8 bg-green-50 rounded p-6">
      <div class="text-3xl font-bold text-green-700">{{ score }} / {{ total }}</div>
      <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-2">Benar {{ score }} dari {{ total }} soal</p>
    </div>
    <Form v-else :fields="fields()" @submit="onSubmit" submit-label="Submit Jawaban" />
  </div>
</template>

<style scoped>
.quiz-taker { width: 100%; }
</style>