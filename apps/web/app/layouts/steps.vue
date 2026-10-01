<script setup lang="ts">
import StepLearningCollapsible from '~/components/layout/StepLearningCollapsible.vue'
import type { User } from '~/interfaces/auth'
import { stepsService } from '~/services/curriculum/steps'
import { userStepService } from '~/services/learning/userStep'
import { useAuth } from '~/stores/auth'
import { useLearning } from '~/stores/learning'

const user = useState<User | null>('user')
const learning = useLearning()
const auth = useAuth()
let loadingInterval: ReturnType<typeof setInterval> | null = null

const stopLoadingTextRotation = () => {
  if (!loadingInterval) return
  clearInterval(loadingInterval)
  loadingInterval = null
}

const key = computed(() =>
  user.value && learning.lessonId
    ? `userSteps-${user.value.id}-${learning.lessonId}`
    : 'userSteps-pending'
)

const { data: resSteps } = await useAsyncData(
  key,
  async () =>
    await stepsService.findAll({
      page: 1,
      limit: 10,
      lessonId: learning.lessonId,
      sort:'sortOrder:asc'
    }),
  {
    immediate: true
  }
)


//  const { data:resUserStep }=await useAsyncData(
//    () => `user-step-S{}`,
//    () =>
//      userStepService.findAll(
//        {
//          page: 1,
//          limit: 1,
//          userId: user.value?.id,
//        },
//        {
//          access_token: auth.access_token,
//          refresh_token: auth.refresh_token
//        }
//      )
//  )



onUnmounted(() => stopLoadingTextRotation())

const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)

const steps=computed(()=>{
  return resSteps.value?.data?.data
})
</script>

<template>
  <div class="flex items-start w-full h-screen text-white overflow-hidden relative">
    <UiDownStarAnimation />

    <UButton
      :icon="sidebarOpen?'i-lucide-x':'i-lucide-sparkles'"
      variant="outline"
      color="secondary"
      size="sm"
      class="fixed top-5 right-6 z-50 md:hidden"
      @click="sidebarOpen = !sidebarOpen"
    />

    <div
      :class="[
        'h-full absolute z-20 transition-all overflow-y-auto duration-500 no-scrollbar border-secondary/80 md:static md:flex md:flex-col backdrop-blur-md',
        sidebarCollapsed ? 'w-20 p-3' : 'w-64 lg:w-[25%] p-4',
        'max-md:fixed max-md:top-0 max-md:left-0 max-md:h-full',
        sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      ]"
    >
      <div class="flex justify-between items-center mb-4">
        <span v-if="!sidebarCollapsed" class="font-semibold text-sm">Tantangan Pembelajaran</span>

        <UButton
          icon="i-lucide-layout-panel-left"
          variant="ghost"
          color="secondary"
          size="xs"
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="transition-transform duration-500 hidden md:flex"
          :class="sidebarCollapsed ? 'rotate-180' : ''"
        />
      </div>

      <div class="flex-1 overflow-y-auto no-scrollbar space-y-2">
        <StepLearningCollapsible v-for="value in steps" :is-collapsible="!sidebarCollapsed" :key="value.id" :step-id="value.id" :step-title="value.title" :user-id="user?.id!" />
      </div>

      <UButton
        icon="i-lucide-chevron-left"
        color="secondary"
        variant="outline"
        class="md:mt-4 w-fit cursor-pointer"
        @click="$router.back()"
        :label="sidebarCollapsed ? '' : 'Kembali'"
      />
    </div>

    <div
      class="flex-1 h-full w-full max-w-8xl mx-auto no-scrollbar no-sc overflow-y-auto relative z-10"
      @click="sidebarOpen = false"
    >
      <slot />
    </div>
    <UiBlackhole />
  </div>
</template>
