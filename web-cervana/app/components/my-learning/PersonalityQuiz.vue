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

const { call }=useApi(personalityQuizService.submitQuiz)
const toast=useToast()

const { data: resPersonalityQuizFindAll, refresh: refreshFindAll } = useAsyncData(
  `personality-quiz-${learning.lessonId}`,
  () =>
    personalityQuizService.findAll({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      lessonId: learning.lessonId
    })
)

const { data: resCurrentLesson } = await useAsyncData<ApiResponse<LessonDetailResponse<true>>>(
  `lesson-current-${learning.lessonId}`,
  () => lessonsService.findOne<true>(learning.lessonId,{
    include:'steps'
  })
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
      lessonId: learning.lessonId,
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
      <div class="overflow-y-auto max-h-screen h-full p-6 flex justify-center items-center flex-col gap-4">
        <h2 class="text-xl font-semibold z-20">Learning Path Quiz</h2>
        <p class="text-base font-medium z-20">{{ resCurrentLesson?.data?.title }}</p>

        <div v-if="questions.length > 0" class="w-full max-w-2xl min-h-[280px] relative pb-10 z-20">
          <Transition name="fade" mode="out-in">
            <div :key="showQuiz">
              <UiRenderMarkdown :text="questions[showQuiz]?.question ?? ''" />

              <div class="mt-6 flex flex-col gap-4">
                <template v-if="questions[showQuiz]?.type === 'multiple_choice'">
                  <UButton
                    v-for="value in questions[showQuiz]?.options"
                    :key="value"
                    class="text-white text-start"
                    :variant="answers[showQuiz]?.userAnswer === value ? 'solid' : 'outline'"
                    @click="setAnswer({
                      question: questions[showQuiz]?.question ?? '',
                      userAnswer: value,
                      answer: questions[showQuiz]?.answer ?? ''
                    })"
                  >
                    {{ value }}
                  </UButton>
                </template>

                <template v-else>
                  <UTextarea
                    :model-value="answers[showQuiz]?.userAnswer || ''"
                    placeholder="Type your answer here..."
                    @input="onInputChange($event, questions[showQuiz]?.question ?? '', questions[showQuiz]?.answer ?? '')"
                  />
                </template>
              </div>
            </div>
          </Transition>

          <div class="flex justify-between items-center mt-6">
            <UButton @click="back" color="warning" :disabled="showQuiz === 0">Back</UButton>

            <UButton
              v-if="showQuiz === questions.length - 1"
              color="success"
              class="text-white"
              :disabled="answers.length !== questions.length"
              @click="submit"
            >
              Submit
            </UButton>

            <UButton
              v-else
              color="warning"
              :disabled="!answers[showQuiz]"
              @click="next"
            >
              Next
            </UButton>
          </div>

          <div class="flex gap-2 items-center mt-6">
            <div
              v-for="(_, i) in questions.length"
              :key="i"
              @click="showQuiz=i"
              :class="[
                'flex-1 h-1.5 rounded-full cursor-pointer transition-all',
                showQuiz === i || answers[i] ? 'bg-secondary' : 'border border-white'
              ]"
            />
          </div>
        </div>
        <UiBlackhole />
        <UiSunset />
        <UiDownStarAnimation />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
