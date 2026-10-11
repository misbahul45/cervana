<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composable/useApi'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type {
  LessonDetailResponse,
  PrevLessonResponse,
  NextLessonResponse
} from '~/interfaces/curriculum/lessons'
import { lessonsService } from '~/services/curriculum/lessons'
import { plainText } from '~/lib/topics'
import { lessonProgressService } from '~/services/learning/lessonsProgress'

const route = useRoute()
const router = useRouter()
const user = useState<User | null>('user')
const { call }=useApi(lessonProgressService.create)


const lessonId = route.params.id as string

const { data: resCurrentLesson } = await useAsyncData<ApiResponse<LessonDetailResponse<true>>>(
  `lesson-current-${lessonId}`,
  () => lessonsService.findOne<true>(lessonId,{
    include:'steps,quiz'
  })
)

const { data: resPrevLesson } = await useAsyncData<ApiResponse<PrevLessonResponse<true>>>(
  `lesson-prev-${lessonId}`,
  () => lessonsService.findPrev<true>(lessonId)
)

const { data: resNextLesson } = await useAsyncData<ApiResponse<NextLessonResponse<true>>>(
  `lesson-next-${lessonId}`,
  () => lessonsService.findNext<true>(lessonId)
)

const { data: resLessonProgress } = await useAsyncData(
  `lesson-progresses-${user.value?.id}-${lessonId}`,
  () =>
    lessonProgressService.findAll({
      userId: user.value?.id!,
      lessonId,
      page: 1,
      limit: 100
    })
)

const currentLesson = computed(() => resCurrentLesson.value?.data ?? null)
const prevLesson = computed(() => resPrevLesson.value?.data?.previous ?? null)
const nextLesson = computed(() => resNextLesson.value?.data?.next ?? null)


const goToLesson = (id: string | undefined, allowed: boolean): void => {
  if (id && allowed) router.push(`/my-learning/lessons/${id}`)
}

const startLesson = () => {
  router.push(`/my-learning/steps?lessonId=${currentLesson.value?.id}`)
}

watch(currentLesson, async (newVal) => {
  if (!newVal) return

  const items = resLessonProgress.value?.data?.data ?? []

  if (items.length === 0) {
    call({
      userId: user.value?.id!,
      lessonId: newVal.id
    })
  }
}, { immediate: true })

const description = computed(() => plainText(currentLesson.value?.description, 260))
const lessonQuiz = computed(() => (currentLesson.value as { quiz?: { id: string } | null } | null)?.quiz ?? null)
const quizId = computed(() => lessonQuiz.value?.id ?? resLessonProgress.value?.data?.data?.[0]?.quizId ?? null)
const stepsCount = computed(() => currentLesson.value?.steps?.length ?? 0)
const resourcesCount = computed(() => currentLesson.value?.resources?.length ?? 0)

useHead({ title: computed(() => `${currentLesson.value?.title ?? 'Pelajaran'} | ReduCera`) })
</script>

<template>
  <div class="rc-stack rc-learning">
    <PageHeader :title="currentLesson?.title ?? 'Pelajaran'" :subtitle="description || undefined">
      <template #actions>
        <PlayButton variant="outline" size="sm" @click="router.back()">Kembali</PlayButton>
      </template>
    </PageHeader>

    <div class="rc-grid">
      <PlayCard as="section" aria-labelledby="lesson-steps">
        <h2 id="lesson-steps" class="rc-h2">Langkah belajar</h2>
        <p class="rc-bignum">{{ stepsCount }}</p>
      </PlayCard>
      <PlayCard as="section" aria-labelledby="lesson-resources">
        <h2 id="lesson-resources" class="rc-h2">Sumber belajar</h2>
        <p class="rc-bignum">{{ resourcesCount }}</p>
      </PlayCard>
    </div>

    <div class="rc-lessons__nav">
      <PlayButton size="lg" @click="startLesson">Mulai belajar</PlayButton>
      <PlayButton v-if="quizId" size="lg" variant="secondary" :to="`/my-learning/quizzes/${quizId}`">Kerjakan kuis</PlayButton>
    </div>

    <nav class="rc-lessons__nav" aria-label="Pelajaran lain">
      <PlayButton
        variant="outline"
        :disabled="!prevLesson"
        @click="goToLesson(prevLesson?.id, !!prevLesson)"
      >
        Pelajaran sebelumnya
      </PlayButton>
      <PlayButton variant="outline" :disabled="!nextLesson?.unlocked" @click="goToLesson(nextLesson?.id, Boolean(nextLesson?.unlocked))">
        Pelajaran berikutnya
      </PlayButton>
    </nav>
  </div>
</template>
