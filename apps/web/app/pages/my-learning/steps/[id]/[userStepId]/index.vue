<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RenderMarkdown from '~/components/ui/RenderMarkdown.vue';
import ActionButton from '~/components/ui/ActionButton.vue';
import QuizTaker from '~/components/learn/QuizTaker.vue';

const route = useRoute();
const router = useRouter();
const stepId = computed(() => String(route.params.userStepId || ''));

const step = ref<{ title: string; body: string; stepId: string; quizId?: string } | null>(null);
const completed = ref(false);

onMounted(async () => {
  try {
    const raw = localStorage.getItem(`step-${stepId.value}`);
    if (raw) {
      step.value = JSON.parse(raw);
    } else {
      step.value = {
        stepId: stepId.value,
        title: `Topik ${stepId.value}`,
        body: `# Selamat Datang\n\nIni adalah pelajaran interaktif untuk topik **${stepId.value}**.\n\n## Materi Pembelajaran\n\n- Konsep dasar double-entry\n- Persamaan akuntansi\n- Jurnal umum\n\n## Contoh Praktis\n\nBerikut adalah simulasi singkat. Cobalah Anda sendiri di sandbox.`,
        quizId: 'demo',
      };
    }
  } catch {
    step.value = null;
  }
});

function next() {
  completed.value = true;
  setTimeout(() => router.push('/my-learning'), 500);
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <div v-if="!step" class="text-center py-8 text-[var(--rc-fg-muted,#6b7280)]">Pelajaran tidak ditemukan</div>
    <div v-else>
      <h1 class="text-3xl font-bold">{{ step.title }}</h1>
      <p class="text-sm text-[var(--rc-fg-muted,#6b7280)]">Topik: {{ step.stepId }}</p>

      <article class="bg-[var(--rc-bg-elevated,#f9fafb)] rounded-lg p-6 border border-[var(--rc-border)] prose dark:prose-invert max-w-full">
        <RenderMarkdown :text="step.body" />
      </article>

      <div v-if="!completed" class="flex justify-end gap-3">
        <ActionButton title="Lanjut ke Kuis" primary description="Uji pemahaman Anda" @click="next" />
      </div>
      <div v-else class="text-center text-green-600 font-semibold">✓ Pelajaran selesai! Mengarahkan ke dashboard...</div>
    </div>
  </main>
</template>