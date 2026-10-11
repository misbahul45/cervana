<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useApi } from '~/composable/useApi'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { LessonDetailResponse } from '~/interfaces/curriculum/lessons'
import type { PersonalityQuizUserAttemptItem } from '~/interfaces/learning/personalityQuiz'
import { lessonsService } from '~/services/curriculum/lessons'
import { personalityQuizService } from '~/services/learning/personalityQuiz'
import { useLearning } from '~/stores/learning'

const user = useState<User | null>('user')
const learning = useLearning()
const lessonId = useLessonId()

const { call }=useApi(personalityQuizService.submitQuiz)
const toast=useToast()

const { data: resPersonalityQuizFindAll, refresh: refreshFindAll } = useAsyncData(
  `personality-quiz-${lessonId.value}`,
  () =>
    personalityQuizService.findAll({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      lessonId: lessonId.value
    })
)

const { data: resCurrentLesson } = await useAsyncData<ApiResponse<LessonDetailResponse<true>>>(
  `personality-lesson-${lessonId.value}`,
  async () =>
    lessonId.value
      ? lessonsService.findOne<true>(lessonId.value, { include: 'steps' })
      : (null as unknown as ApiResponse<LessonDetailResponse<true>>)
)

const showModal = ref(false)
let es: EventSource | null = null
onMounted(() => {
  const list = resPersonalityQuizFindAll.value?.data?.data
  if (Array.isArray(list) && list.length === 1) {
    const item = list[0]
    if (item && !item.takenAt) showModal.value = true
    return
  }

  es = personalityQuizService.listenPersonalityQuizSse()
  if (!es) return

  es.onmessage = async () => {
    await refreshFindAll()
    const listUpdated = resPersonalityQuizFindAll.value?.data?.data
    if (Array.isArray(listUpdated) && listUpdated.length === 1) {
      es?.close()
      es = null
      showModal.value = true
    }
  }
})

onBeforeUnmount(() => {
  if (es) es.close()
})

const quiz = computed(() => {
  const list = resPersonalityQuizFindAll.value?.data?.data
  return (Array.isArray(list) && list.length === 1) ? list[0] : null
})


const questions = computed(() => {
  const list = resPersonalityQuizFindAll.value?.data?.data
  if (Array.isArray(list) && list.length === 1) {
    return list[0]?.questions ?? []
  }
  return []
})

const showQuiz = ref(0)
const answers = ref<PersonalityQuizUserAttemptItem[]>([])
const direction = ref('next')

const setAnswer = (value: PersonalityQuizUserAttemptItem) => {
  const index = answers.value.findIndex(a => a.question === value.question)
  if (index !== -1) answers.value[index] = value
  else answers.value.push(value)
}

const onInputChange = (e: Event, q: string, answer: string) => {
  const target = e.target as HTMLTextAreaElement
  setAnswer({ question: q, userAnswer: target.value, answer })
}

const next = () => {
  if (!answers.value[showQuiz.value]) return
  direction.value = 'next'
  if (showQuiz.value < questions.value.length - 1) showQuiz.value++
}

const back = () => {
  direction.value = 'back'
  if (showQuiz.value > 0) showQuiz.value--
}

const submit = async () => {
  if (!quiz.value) return
  if (answers.value.length !== questions.value.length) return

  await call(
    quiz.value.id,
    {
      topicId: learning.topicId,
      lessonId: lessonId.value,
      learningStyleId: learning.learningStyleId
    },
    answers.value
  )
  toast.add({
    title: 'Generating Learning Path Quiz Completed',
    color: 'primary',
    icon: 'i-heroicons-check-circle-20-solid'
  })

  showModal.value = false
}

</script>

<template>
  <UModal v-model:open="showModal" fullscreen>
    <template #content>
      <div class="rc-quiz">
        <header class="rc-quiz__head">
          <h2 class="rc-quiz__title">Kuis jalur belajar</h2>
          <p class="rc-hint">{{ resCurrentLesson?.data?.title }}</p>
        </header>

        <div v-if="questions.length > 0" class="rc-quiz__body">
          <PlayProgress
            :value="((showQuiz + 1) / questions.length) * 100"
            :label="`Soal ${showQuiz + 1} dari ${questions.length}`"
            tone="success"
          />

          <Transition name="fade" mode="out-in">
            <div :key="showQuiz" class="rc-quiz__question">
              <UiRenderMarkdown :text="questions[showQuiz]?.question ?? ''" />

              <div class="rc-quiz__answers">
                <template v-if="questions[showQuiz]?.type === 'multiple_choice'">
                  <button
                    v-for="value in questions[showQuiz]?.options"
                    :key="value"
                    type="button"
                    class="rc-quiz__option"
                    :aria-pressed="answers[showQuiz]?.userAnswer === value"
                    @click="setAnswer({
                      question: questions[showQuiz]?.question ?? '',
                      userAnswer: value,
                      answer: questions[showQuiz]?.answer ?? ''
                    })"
                  >
                    {{ value }}
                  </button>
                </template>

                <template v-else>
                  <label class="rc-label" for="quiz-answer">Jawabanmu</label>
                  <textarea
                    id="quiz-answer"
                    class="rc-field"
                    rows="4"
                    :value="answers[showQuiz]?.userAnswer || ''"
                    placeholder="Tulis jawabanmu di sini"
                    @input="onInputChange($event, questions[showQuiz]?.question ?? '', questions[showQuiz]?.answer ?? '')"
                  ></textarea>
                </template>
              </div>
            </div>
          </Transition>

          <div class="rc-quiz__nav">
            <PlayButton variant="outline" :disabled="showQuiz === 0" @click="back">Sebelumnya</PlayButton>

            <PlayButton
              v-if="showQuiz === questions.length - 1"
              :disabled="answers.length !== questions.length"
              @click="submit"
            >
              Kirim jawaban
            </PlayButton>

            <PlayButton v-else :disabled="!answers[showQuiz]" @click="next">Berikutnya</PlayButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style>
.rc-quiz {
  display: grid;
  gap: 1.5rem;
  align-content: start;
  width: 100%;
  max-width: 42rem;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  background-color: var(--rc-surface);
  color: var(--rc-fg);
}
.rc-quiz__head {
  display: grid;
  gap: 0.25rem;
}
.rc-quiz__title {
  margin: 0;
  font-size: 1.5rem;
}
.rc-quiz__body,
.rc-quiz__question {
  display: grid;
  gap: 1.25rem;
}
.rc-quiz__answers {
  display: grid;
  gap: 0.75rem;
}
.rc-quiz__option {
  width: 100%;
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--rc-border);
  border-radius: calc(var(--rc-radius, 16px) - 2px);
  background-color: var(--rc-surface);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-border);
  color: var(--rc-fg);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.rc-quiz__option:hover {
  background-color: var(--rc-foam);
}
.rc-quiz__option[aria-pressed="true"] {
  border-color: var(--rc-secondary);
  background-color: color-mix(in srgb, var(--rc-secondary) 12%, var(--rc-surface));
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-secondary-depth);
}
.rc-quiz__option:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 3px;
}
.rc-quiz__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>
