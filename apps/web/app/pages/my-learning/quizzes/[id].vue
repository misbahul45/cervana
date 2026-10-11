<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref } from 'vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import RenderMarkdown from '~/components/ui/RenderMarkdown.vue'
import { rewardHeadline } from '~/lib/gamify'
import { QK } from '~/lib/query-keys'
import { buildSubmission, canSubmit, isAnswered, normalizeQuestions, resultSummary, type Answers } from '~/lib/quiz'
import { authMessage } from '~/lib/auth-form'
import { quizService, type QuizAttemptRow, type QuizSubmitResult } from '~/services/learning/quiz'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()

const quizId = computed(() => String(route.params.id || ''))

const [{ data: quizRes }, { data: questionsRes }] = await Promise.all([
  useAsyncData(() => `quiz-${quizId.value}`, () => quizService.findOne(quizId.value), { watch: [quizId] }),
  useAsyncData(() => `quiz-questions-${quizId.value}`, () => quizService.questions(quizId.value), { watch: [quizId] }),
])

const quiz = computed(() => quizRes.value?.data ?? null)
const questions = computed(() => normalizeQuestions(questionsRes.value?.data?.data))
const unavailable = computed(() => !questions.value.length)

type Phase = 'intro' | 'taking' | 'done'
const phase = ref<Phase>('intro')
const index = ref(0)
const answers = reactive<Answers>({})
const attempt = ref<QuizAttemptRow | null>(null)
const result = ref<QuizSubmitResult | null>(null)
const busy = ref(false)
const message = ref('')

const current = computed(() => questions.value[index.value])
const isLast = computed(() => index.value === questions.value.length - 1)
const summary = computed(() => resultSummary(result.value?.isCorrect))
const rewards = computed(() => (result.value?.gamify ? rewardHeadline(result.value.gamify) : []))

useHead({ title: computed(() => `${quiz.value?.title ?? 'Kuis'} | ReduCera`) })

async function begin() {
  busy.value = true
  message.value = ''
  try {
    const started = await quizService.startAttempt(quizId.value)
    if (!started.success || !started.data) {
      message.value = authMessage(started.message, started.meta?.statusCode)
      return
    }
    attempt.value = started.data
    for (const key of Object.keys(answers)) delete answers[key]
    index.value = 0
    phase.value = 'taking'
  } finally {
    busy.value = false
  }
}

async function submit() {
  if (!attempt.value || busy.value || !canSubmit(questions.value, answers)) return
  busy.value = true
  message.value = ''
  try {
    const sent = await quizService.submitAttempt(attempt.value.id, buildSubmission(questions.value, answers))
    if (!sent.success || !sent.data) {
      message.value = authMessage(sent.message, sent.meta?.statusCode)
      return
    }
    result.value = sent.data
    phase.value = 'done'
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QK.gamify.me() }),
      queryClient.invalidateQueries({ queryKey: QK.gamify.achievements() }),
    ])
    if (rewards.value.length) {
      toast.add({ title: 'Kuis selesai', description: rewards.value.map((line) => line.text).join(' · '), color: 'success', icon: 'i-lucide-party-popper' })
    }
  } finally {
    busy.value = false
  }
}

function retry() {
  result.value = null
  phase.value = 'intro'
}
</script>

<template>
  <div class="rc-stack rc-learning">
    <EmptyState
      v-if="unavailable"
      icon-name="i-lucide-file-question"
      title="Kuis tidak tersedia"
      message="Kuis ini tidak ada, belum berisi soal, atau bukan milikmu."
      cta-label="Kembali"
      cta-to="/learn/profile/my-learning"
    />

    <template v-else>
      <PageHeader :title="quiz?.title ?? 'Kuis'" :subtitle="`${questions.length} soal`">
        <template #actions>
          <PlayButton variant="outline" size="sm" @click="router.back()">Kembali</PlayButton>
        </template>
      </PageHeader>

      <PlayCard v-if="phase === 'intro'" as="section" aria-labelledby="quiz-intro">
        <h2 id="quiz-intro" class="rc-h2">Siap mengerjakan?</h2>
        <p class="rc-hint">Jawabanmu dinilai oleh sistem. XP, streak, dan bintang hanya dihitung dari hasil penilaian ini.</p>
        <p v-if="message" class="rc-alert rc-alert--error" role="alert">{{ message }}</p>
        <div>
          <PlayButton size="lg" :loading="busy" @click="begin">Mulai kuis</PlayButton>
        </div>
      </PlayCard>

      <PlayCard v-else-if="phase === 'taking' && current" as="section" aria-labelledby="quiz-question">
        <PlayProgress :value="((index + 1) / questions.length) * 100" :label="`Soal ${index + 1} dari ${questions.length}`" />
        <h2 id="quiz-question" class="rc-h2">Soal {{ index + 1 }}</h2>
        <RenderMarkdown :text="current.prompt" />

        <div v-if="!current.supported" class="rc-alert rc-alert--info" role="status">
          Jenis soal ini belum bisa dikerjakan di sini dan dilewati saat dinilai.
        </div>

        <div v-else-if="current.type === 'MULTIPLE_CHOICE'" class="rc-answers" role="group" aria-labelledby="quiz-question">
          <button
            v-for="option in current.options"
            :key="option"
            type="button"
            class="rc-answer"
            :aria-pressed="answers[current.id] === option"
            @click="answers[current.id] = option"
          >
            {{ option }}
          </button>
        </div>

        <div v-else>
          <label class="rc-label" :for="`answer-${current.id}`">Jawabanmu</label>
          <textarea :id="`answer-${current.id}`" v-model="answers[current.id]" class="rc-field" rows="5" placeholder="Tulis jawabanmu di sini"></textarea>
        </div>

        <p v-if="message" class="rc-alert rc-alert--error" role="alert">{{ message }}</p>

        <div class="rc-lessons__nav">
          <PlayButton variant="outline" :disabled="index === 0" @click="index -= 1">Sebelumnya</PlayButton>
          <PlayButton v-if="!isLast" :disabled="current.supported && !isAnswered(current, answers)" @click="index += 1">Berikutnya</PlayButton>
          <PlayButton v-else :loading="busy" :disabled="!canSubmit(questions, answers)" @click="submit">Kirim jawaban</PlayButton>
        </div>
      </PlayCard>

      <template v-else-if="phase === 'done'">
        <PlayCard as="section" aria-labelledby="quiz-result" :tone="summary.percent >= (quiz?.passingScore ?? 70) ? 'success' : 'default'">
          <h2 id="quiz-result" class="rc-h2">Hasilmu</h2>
          <p class="rc-bignum">{{ summary.percent }}%</p>
          <p class="rc-hint">{{ summary.correct }} dari {{ summary.total }} soal benar.</p>
          <PlayProgress :value="summary.percent" label="Nilai kuis" :tone="summary.percent >= (quiz?.passingScore ?? 70) ? 'success' : 'info'" />
        </PlayCard>

        <PlayCard v-if="rewards.length" as="section" tone="gold" aria-labelledby="quiz-rewards">
          <h2 id="quiz-rewards" class="rc-h2">Hadiah</h2>
          <ul class="rc-rewards">
            <li v-for="line in rewards" :key="line.text" class="rc-rewards__line">
              <GameIcon :name="line.icon" :size="32" decorative />
              <span>{{ line.text }}</span>
            </li>
          </ul>
        </PlayCard>

        <PlayCard as="section" aria-labelledby="quiz-review">
          <h2 id="quiz-review" class="rc-h2">Per soal</h2>
          <ol class="rc-review">
            <li v-for="(question, number) in questions" :key="question.id" class="rc-review__item">
              <UIcon
                :name="result?.isCorrect?.[question.id] ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                :class="result?.isCorrect?.[question.id] ? 'rc-review__ok' : 'rc-review__no'"
                aria-hidden="true"
              />
              <span>Soal {{ number + 1 }}: {{ result?.isCorrect?.[question.id] ? 'benar' : 'belum tepat' }}</span>
            </li>
          </ol>
        </PlayCard>

        <div class="rc-lessons__nav">
          <PlayButton variant="outline" @click="retry">Coba lagi</PlayButton>
          <PlayButton @click="router.back()">Selesai</PlayButton>
        </div>
      </template>
    </template>
  </div>
</template>
