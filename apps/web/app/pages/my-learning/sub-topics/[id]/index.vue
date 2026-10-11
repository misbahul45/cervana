<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { BaseLesson } from '~/interfaces/curriculum/lessons'
import type { NavigationSubTopicResponse } from '~/interfaces/curriculum/subTopics'
import { LearningStatus, type SubTopicProgress } from '~/interfaces/learning/subTopicProgress'
import { subTopicsService } from '~/services/curriculum/subTopics'
import { subTopicProgressService } from '~/services/learning/subTopicProgress'
import { plainText } from '~/lib/topics'
import { useLearning } from '~/stores/learning'

const route = useRoute()
const user = useState<User | null>('user')
const learning=useLearning()

const { data: resNavigation } = await useAsyncData<ApiResponse<NavigationSubTopicResponse<true>>>(
  `subTopic-navigation-${route.params.id}`,
  async () => subTopicsService.findNavigation(route.params.id as string)
)

const navigation = computed(() => resNavigation.value?.data || null)
const subTopic = computed(() => navigation.value?.current || null)
const nextSubTopic = computed(() => navigation.value?.next || null)
const prevSubTopic = computed(() => navigation.value?.previous || null)


const lessons = computed<BaseLesson[]>(() => subTopic.value?.lessons || [])

const completedLessonIds = computed(() => {
  const progressData = resSubTopicProgress.value?.data?.data || []
  return progressData.map((progress: SubTopicProgress) => 
    typeof progress === 'string' ? progress : progress.id
  )
})



const hasLearning = (id: string) => completedLessonIds.value.includes(id)
const isLessonUnlocked = (lesson: BaseLesson, index: number) => index === 0 || hasLearning(lessons.value[index - 1]?.id || '')

const router = useRouter()
const goTo = (id: string, isUnlocked: boolean) => { 
  if (isUnlocked) {
    learning.setLesson(id)


    router.push(`/my-learning/lessons/${id}`)
  }
 }

const { data: resSubTopicProgress } = await useAsyncData(
  `subTopic-progresses-${user.value?.id}`,
  async () =>
    subTopicProgressService.findAll({
      page: 1,
      limit: 100,
      userId: user.value?.id,
      subTopicId: route.params.id
    })
)

if ((resSubTopicProgress.value?.data?.data.length ?? 0) === 0) {
  await subTopicProgressService.create({
    userId: user.value!.id,
    subTopicId: String(route.params.id),
    progress: 0,
    completed: false,
    status: LearningStatus.IN_PROGRESS
  })
}

watch(() => route.params.id, (newId) => {
  if (newId) {
    learning.setSubTopic(String(newId));
  }
}, { immediate: true });

const description = computed(() => plainText(subTopic.value?.description, 220))
const allDone = computed(() => lessons.value.length > 0 && lessons.value.every((lesson) => hasLearning(lesson.id)))

const lessonState = (lesson: BaseLesson, index: number) => {
  if (hasLearning(lesson.id)) return 'done' as const
  return isLessonUnlocked(lesson, index) ? ('open' as const) : ('locked' as const)
}

const STATE_TEXT = {
  done: 'Selesai',
  open: 'Siap dikerjakan',
  locked: 'Selesaikan pelajaran sebelumnya',
} as const

const STATE_ICON = { done: 'star', open: null, locked: 'lock' } as const

useHead({ title: computed(() => `${subTopic.value?.title ?? 'Bagian belajar'} | ReduCera`) })
</script>

<template>
  <div class="rc-stack rc-learning">
    <PageHeader :title="subTopic?.title ?? 'Bagian belajar'" :subtitle="description || undefined">
      <template #actions>
        <PlayButton variant="outline" size="sm" @click="router.back()">Kembali</PlayButton>
      </template>
    </PageHeader>

    <section aria-labelledby="lesson-list-title">
      <h2 id="lesson-list-title" class="rc-h2">Pelajaran</h2>

      <ol v-if="lessons.length" class="rc-lessons">
        <li v-for="(lesson, index) in lessons" :key="lesson.id">
          <PlayCard class="rc-lesson" :tone="lessonState(lesson, index) === 'done' ? 'gold' : 'default'">
            <GameIcon v-if="STATE_ICON[lessonState(lesson, index)]" :name="STATE_ICON[lessonState(lesson, index)]!" :size="40" decorative />
            <span v-else class="rc-lesson__play" aria-hidden="true"><UIcon name="i-lucide-play" /></span>
            <div class="rc-lesson__text">
              <h3 class="rc-lesson__title">{{ lesson.title }}</h3>
              <p class="rc-hint">{{ STATE_TEXT[lessonState(lesson, index)] }}</p>
            </div>
            <PlayButton
              size="sm"
              :variant="lessonState(lesson, index) === 'done' ? 'outline' : 'primary'"
              :disabled="lessonState(lesson, index) === 'locked'"
              @click="goTo(lesson.id, lessonState(lesson, index) !== 'locked')"
            >
              {{ lessonState(lesson, index) === 'done' ? 'Ulangi' : 'Mulai' }}
            </PlayButton>
          </PlayCard>
        </li>
      </ol>
      <p v-else class="rc-hint">Belum ada pelajaran di bagian ini.</p>
    </section>

    <nav v-if="prevSubTopic || (nextSubTopic && allDone)" class="rc-lessons__nav" aria-label="Bagian lain">
      <PlayButton v-if="prevSubTopic" :to="`/my-learning/sub-topics/${prevSubTopic.id}`" variant="outline">Bagian sebelumnya</PlayButton>
      <PlayButton v-if="nextSubTopic && allDone" :to="`/my-learning/sub-topics/${nextSubTopic.id}`">Bagian berikutnya</PlayButton>
    </nav>
  </div>
</template>
