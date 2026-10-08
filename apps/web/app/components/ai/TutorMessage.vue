<script setup lang="ts">
import { ref } from 'vue';

interface Citation {
  source: string;
  snippet: string;
  lessonId?: string;
}

interface TutorAnswer {
  explanation: string;
  examples?: string[];
  steps?: string[];
  citations?: Citation[];
  nextAction?: string;
}

defineProps<{
  answer: TutorAnswer | null;
  personalizedHint?: string;
}>();

const open = ref(false);

function dismiss() {
  open.value = false;
}
</script>

<template>
  <article
    v-if="answer"
    class="rc-tutor-message"
    aria-labelledby="rc-tutor-message-ai-label"
  >
    <header class="rc-tutor-message__header">
      <UIcon name="i-lucide-sparkles" aria-hidden="true" />
      <strong>Dijawab oleh AI.</strong>
      <p v-if="personalizedHint" class="rc-tutor-message__personalization">
        {{ personalizedHint }}
      </p>
    </header>
    <section class="rc-tutor-message__explanation">
      <p>{{ answer.explanation }}</p>
    </section>
    <section v-if="answer.examples && answer.examples.length" aria-label="Contoh">
      <h4>Contoh</h4>
      <ul>
        <li v-for="(ex, i) in answer.examples" :key="i">{{ ex }}</li>
      </ul>
    </section>
    <section v-if="answer.steps && answer.steps.length" aria-label="Langkah">
      <h4>Langkah</h4>
      <ol>
        <li v-for="(s, i) in answer.steps" :key="i">{{ s }}</li>
      </ol>
    </section>
    <CitationList :citations="answer.citations || []" />
    <footer v-if="answer.nextAction" class="rc-tutor-message__next">
      <strong>Selanjutnya:</strong> {{ answer.nextAction }}
      <button v-if="!open" type="button" class="rc-tutor-message__dismiss" @click="dismiss">
        Tutup
      </button>
    </footer>
  </article>
</template>

<style scoped>
.rc-tutor-message {
  padding: 1.25rem;
  border-radius: 0.875rem;
  background: var(--ui-bg-elevated, transparent);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
.rc-tutor-message__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.rc-tutor-message__header strong { color: var(--ui-text); }
.rc-tutor-message__personalization {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  flex: 1;
}
.rc-tutor-message__explanation p { line-height: 1.6; }
.rc-tutor-message__next {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-tutor-message__dismiss {
  background: transparent;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.375rem;
  padding: 0.25rem 0.625rem;
  cursor: pointer;
}
</style>