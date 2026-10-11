<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
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
let eventSource: EventSource | null = null

const { data: resUserSteps, refresh, status } = await useAsyncData<
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

const userSteps = computed(() => resUserSteps.value?.data?.data ?? [])
const hasSteps = computed(() => userSteps.value.length > 0)
const isLoading = computed(() => status.value === 'pending' && !hasSteps.value)

watch(
  hasSteps,
  (ready) => {
    if (ready) stopListeningSse()
    else startListeningSse()
  },
  { immediate: true }
)

onBeforeUnmount(() => stopListeningSse())
</script>


<template>
  <section class="rc-stepgroup">
    <h3 v-if="isCollapsible" class="rc-stepgroup__title">{{ stepTitle }}</h3>

    <div v-if="isLoading" class="rc-stepgroup__loading" aria-busy="true">
      <span v-for="value in 4" :key="value" class="rc-skel rc-skel--line"></span>
    </div>
    <p v-else-if="!hasSteps" class="rc-hint" role="status">Langkah muncul setelah kuis gaya belajar selesai dan materinya siap.</p>

    <ul class="rc-stepgroup__list">
      <li v-for="value in userSteps" :key="value.id">
        <button
          type="button"
          class="rc-stepgroup__item"
          :class="{ 'rc-stepgroup__item--active': learning.userStepId === value.id, 'rc-stepgroup__item--done': value.isDone }"
          :disabled="!value.isUnlocked"
          :aria-current="learning.userStepId === value.id ? 'step' : undefined"
          @click="value.isUnlocked && goTo(value.id)"
        >
          <GameIcon :name="!value.isUnlocked ? 'lock' : value.isDone ? 'star' : 'node'" :size="24" decorative />
          <span class="rc-stepgroup__label">{{ value.title }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style>
.rc-stepgroup {
  display: grid;
  gap: 0.5rem;
}
.rc-stepgroup__title {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 800;
}
.rc-stepgroup__loading {
  display: grid;
  gap: 0.5rem;
}
.rc-stepgroup__list {
  display: grid;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-stepgroup__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.375rem 0.75rem;
  border: 2px solid transparent;
  border-radius: calc(var(--rc-radius, 16px) - 4px);
  background: transparent;
  color: var(--rc-fg);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.rc-stepgroup__item:hover:not(:disabled) {
  background-color: var(--rc-foam);
}
.rc-stepgroup__item--active {
  border-color: var(--rc-secondary);
  background-color: color-mix(in srgb, var(--rc-secondary) 10%, var(--rc-surface));
}
.rc-stepgroup__item:disabled {
  color: var(--rc-muted);
  cursor: not-allowed;
}
.rc-stepgroup__item:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 2px;
}
.rc-stepgroup__label {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
