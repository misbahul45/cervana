<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useApi } from '~/composable/useApi';
import type { ApiResponse } from '~/interfaces/api'
import type { StepProgressListResponse } from '~/interfaces/learning/stepProgress';
import type { UserStepListResponse } from '~/interfaces/learning/userSteps'
import { stepProgressService } from '~/services/learning/stepProgresses';
import { userStepService } from '~/services/learning/userStep'
import { useLearning } from '~/stores/learning';

const { stepId, stepTitle, userId, isCollapsible } = defineProps<{
  stepId: string
  stepTitle: string
  userId: string
  isCollapsible:boolean
}>()

const router=useRouter()
const learning=useLearning()
const isGenerating = ref(true)
let eventSource: EventSource | null = null

const { data: resUserSteps, refresh } = await useAsyncData<
  ApiResponse<UserStepListResponse<true>>
>(
  `${stepId}-${userId}`,
  () =>
    userStepService.findAll({
      page: 1,
      limit: 100,
      stepTemplateId: stepId,
      userId,
      sort:'order:asc'
    })
)


const { call }=useApi(stepProgressService.create)

const { data:resStepProgress } = await useAsyncData<
  ApiResponse<StepProgressListResponse>
>(
  `step-progress-${stepId}-${userId}`,
  () =>stepProgressService.findAll({
    page:1,
    limit:1,
    stepId:stepId,
    userId
  })
) 



watch(
  resStepProgress,
  async (newVal) => {
    if (newVal?.data?.data?.length) return

    await call({
      userId,
      stepId
    })

    await refresh()
  },
  { immediate: true }
)



const startListeningSse = () => {
  if (eventSource) return
  eventSource = userStepService.listenUserStepsSse()

  eventSource.onmessage = async (event) => {
    const parsed = JSON.parse(event.data)
    if (parsed.userId !== userId) return
    if (parsed.stepId !== stepId) return

    await refresh()

    if (parsed.isDone) stopListeningSse()
  }

  eventSource.onerror = () => stopListeningSse()
}

const stopListeningSse = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const goTo=(id:string)=>{
  router.push(`/my-learning/steps/${stepId}/${id}`)
  learning.setUserStep(id)
}

watch(
  resUserSteps,
  (newVal) => {
    const steps = newVal?.data?.data ?? []
    const totalExpected = newVal?.data?.pagination.total ?? 0
    const isComplete = totalExpected > 0 && steps.length >= totalExpected

    isGenerating.value = !isComplete

    if (!isComplete) startListeningSse()
    else stopListeningSse()
  },
  { immediate: true }
)

onBeforeUnmount(() => stopListeningSse())
</script>


<template>
  <div class="space-y-4 relative text-nowrap truncate">
    <div class="flex gap-1 items-center">
      <h3 v-if="isCollapsible" class="text-xs text-nowrap truncate">{{ stepTitle }}</h3>
    </div>

    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
    >
      <div class="ml-1 relative" v-if="true">
        <div class="absolute top-0 -left-2 bg-primary rounded-r-full w-0.5 h-full" />

        <div v-if="isGenerating" class="space-y-4">
          <UiLoading v-for="value in 5" :key="value" size="xs" :show-text="isCollapsible" />
        </div>

        <UTooltip 
          v-for="value in resUserSteps?.data?.data ?? []"
          :key="value.id" :title="value.title">
          <UButton
            :color="value.isDone?'secondary':'primary'"
            :variant="learning.userStepId === value.id ? 'outline' : 'ghost'"
            @click="value.isUnlocked && goTo(value.id)"
            :disabled="!value.isUnlocked"
            :ui="{
              leadingIcon:!value.isUnlocked?'text-error':value.isDone?'text-success':'text-secondary'
            }"
            class="flex items-center justify-start mb-4 cursor-pointer text-white"
          >
            <span v-if="!value.isUnlocked">🔒</span>
            <span v-else>
              <span v-if="!value.isDone">🚀</span>
              <span v-else>✅</span>
            </span>
            <p v-if="isCollapsible" class="flex-1 text-[10px] max-w-full truncate ml-2">{{ value.title }}</p>
          </UButton>
        </UTooltip>
      </div>
    </transition>
  </div>
</template>
