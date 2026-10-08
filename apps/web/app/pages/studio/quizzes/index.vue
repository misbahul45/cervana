<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import Form from '~/components/ui/Form.vue';
import JsonEditor from '~/components/editor/JsonEditor.vue';

const router = useRouter();

const form = reactive({
  title: '',
  description: '',
  topicId: '',
  durationMinutes: 30,
  config: { type: 'multiple_choice', questions: [] as Array<{ prompt: string; options: string[]; correct: number }> },
});

const submitting = ref(false);
const error = ref('');

function addQuestion() {
  form.config.questions.push({ prompt: '', options: ['', ''], correct: 0 });
}

function removeQuestion(i: number) {
  form.config.questions.splice(i, 1);
}

async function save() {
  error.value = 'Pembuatan kuis oleh kreator belum tersedia di sistem.';
}

function fields() {
  return [
    { name: 'title', label: 'Judul Kuis', type: 'text', required: true },
    { name: 'topicId', label: 'Topik (contoh: l1-t01-accounting-equation)', type: 'text', required: true },
    { name: 'durationMinutes', label: 'Durasi (menit)', type: 'number', required: true },
  ];
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Kuis Baru</h1>
    <p role="note" class="text-[var(--rc-fg-muted,#6b7280)]">Fitur pembuatan kuis oleh kreator belum tersedia. Formulir ini belum menyimpan apa pun.</p>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">JSON upload: array of questions. Contoh:
      <code class="bg-[var(--rc-bg-elevated,#f3f4f6)] px-1 rounded">{"[{prompt, options, correct}]"}</code>
    </p>

    <div v-if="error" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</div>

    <Form :fields="fields()" @submit="(d) => Object.assign(form, d) && save()" submit-label="Simpan" />

    <div>
      <label class="block font-medium mb-2">Soal ({{ form.config.questions.length }})</label>
      <div v-for="(q, i) in form.config.questions" :key="i" class="bg-[var(--rc-bg-elevated,#f9fafb)] p-3 rounded mb-2 space-y-2">
        <input v-model="q.prompt" placeholder="Pertanyaan" class="w-full px-3 py-2 rounded border border-[var(--rc-border)]" />
        <div v-for="(opt, j) in q.options" :key="j" class="flex gap-2 items-center">
          <input type="radio" :name="`correct-${i}`" :checked="q.correct === j" @change="q.correct = j" />
          <input v-model="q.options[j]" :placeholder="`Opsi ${j + 1}`" class="flex-1 px-3 py-2 rounded border border-[var(--rc-border)]" />
        </div>
        <button type="button" class="text-sm text-red-600" @click="removeQuestion(i)">Hapus</button>
      </div>
      <button type="button" class="text-sm text-[var(--rc-primary,#3b82f6)]" @click="addQuestion">+ Tambah soal</button>
    </div>
  </main>
</template>