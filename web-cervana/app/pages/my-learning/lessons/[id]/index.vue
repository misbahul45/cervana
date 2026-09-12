<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sunset from '~/components/ui/Sunset.vue'
import { useApi } from '~/composable/useApi'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type {
  LessonDetailResponse,
  PrevLessonResponse,
  NextLessonResponse
} from '~/interfaces/curriculum/lessons'
import { lessonsService } from '~/services/curriculum/lessons'
import { lessonProgressService } from '~/services/learning/lessonsProgress'

const route = useRoute()
const router = useRouter()
const user = useState<User | null>('user')
const { call }=useApi(lessonProgressService.create)


const lessonId = route.params.id as string

const { data: resCurrentLesson } = await useAsyncData<ApiResponse<LessonDetailResponse<true>>>(
  `lesson-current-${lessonId}`,
  () => lessonsService.findOne<true>(lessonId,{
    include:'steps'
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

const completedLessonIds = computed(() => {
  const items = resLessonProgress.value?.data?.data || []
  return items.map((p: any) => (typeof p === 'string' ? p : p.id))
})

const hasLearning = (id: string) => completedLessonIds.value.includes(id)


const goToLesson = (id: string, unlocked: boolean): void => {
  if (unlocked) router.push(`/my-learning/lessons/${id}`)
}

const startLesson = () => {
  router.push(`/my-learning/steps?lessonId=${currentLesson.value?.id}`)
}

const auroraBg = computed(() => `
  radial-gradient(ellipse 120% 80% at 50% -20%, ${currentLesson.value?.theme?.primary}65 0%, transparent 50%),
  radial-gradient(ellipse 100% 100% at 15% 30%, ${currentLesson.value?.theme?.secondary}50 0%, transparent 60%),
  radial-gradient(ellipse 100% 100% at 85% 40%, ${nextLesson.value?.theme?.primary ?? currentLesson.value?.theme?.primary}45 0%, transparent 65%),
  radial-gradient(ellipse 80% 60% at 50% 80%, ${nextLesson.value?.theme?.secondary ?? currentLesson.value?.theme?.secondary}40 0%, transparent 70%),
  linear-gradient(180deg, #050616 0%, #0c1127 40%, #06091a 100%)
`)

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


</script>

<template>
  <div class="relative w-full flex pt-20 pb-8 min-h-screen items-center justify-center">
    <div class="absolute inset-0" :style="{ background: auroraBg }"></div>
    <div class="stars"></div>
    <div class="stars-layer-2"></div>
    <div class="absolute inset-0 backdrop-blur-[1px]"></div>

    <div class="relative z-20 flex flex-col items-center justify-center px-4 md:px-6 mx-auto max-w-5xl w-full animate-fade-down">
      <div class="text-center mb-8 animate-fade-down" style="animation-delay: 0.1s">
        <h1 class="text-white text-2xl md:text-3xl xl:text-4xl 2xl:text-5xl font-bold font-orbitron mb-4 drop-shadow-lg]">
          {{ currentLesson?.title }}
        </h1>
        
        <div v-if="currentLesson?.description" 
             class="text-gray-300 text-xs md:text-base xl:text-lg 2xl:text-xl max-w-2xl mx-auto leading-relaxed"
             v-html="currentLesson?.description" 
        />
      </div>

      <div class="flex gap-6 mb-10 animate-fade-down" style="animation-delay: 0.2s">
        <div class="bg-white/10 border-2 border-secondary/20 backdrop-blur-lg px-6 py-4 rounded-2xl text-center min-w-[140px]">
          <div class="text-4xl font-bold text-white mb-1 font-orbitron">
            {{ currentLesson?.steps?.length || 0 }}
          </div>
          <div class="text-sm text-gray-300 uppercase tracking-wider">Mission Steps</div>
        </div>

        <div class="bg-white/10 border-2 border-secondary/20 backdrop-blur-lg px-6 py-4 rounded-2xl text-center min-w-[140px]">
          <div class="text-4xl font-bold text-white mb-1 font-orbitron">
            {{ currentLesson?.resources?.length || 0 }}
          </div>
          <div class="text-sm text-gray-300 uppercase tracking-wider">Space Resources</div>
        </div>
      </div>

      <div class="flex gap-4 mb-12 animate-fade-down" style="animation-delay: 0.3s">
        <UButton
          size="lg"
          class="px-8 py-3 text-lg active:scale-95 cursor-pointer font-semibold rounded-xl shadow-xl hover:scale-105 transition-transform"
          :style="{ 
            background: `linear-gradient(135deg, ${currentLesson?.theme?.primary} 0%, ${currentLesson?.theme?.secondary} 100%)`,
            border: 'none'
          }"
          variant="subtle"
          icon="i-lucide-rocket"
          @click="startLesson"
        >
          Launch Our Steps
        </UButton>
      </div>

      <div class="flex gap-4 animate-fade-down" style="animation-delay: 0.4s">
        <UButton
          variant="outline"
          :disabled="!prevLesson || !hasLearning(prevLesson.id)"
          @click="goToLesson(prevLesson?.id!, !!prevLesson)"
          class="glass-card border-gray-600 hover:border-gray-400 transition-all flex items-center gap-2"
          icon="i-lucide-chevron-left"
        >
          Previous Mission
        </UButton>

        <UButton
          variant="outline"
          :disabled="!nextLesson"
          @click="goToLesson(nextLesson?.id!, !!nextLesson)"
          class="glass-card border-gray-600 hover:border-gray-400 transition-all flex items-center gap-2"
          trailing-icon="i-lucide-chevron-right"
        >
          Next Mission
        </UButton>
      </div>

    </div>

    <Sunset />
    <UiDownStarAnimation />
  </div>
</template>

<style scoped>
@keyframes fade-down {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-down {
  animation: fade-down 0.6s ease-out forwards;
  opacity: 0;
}
</style>
