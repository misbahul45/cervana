<script setup lang="ts">
import { computed, ref } from 'vue'
import StepLearningCollapsible from '~/components/layout/StepLearningCollapsible.vue'
import type { User } from '~/interfaces/auth'
import { stepsService } from '~/services/curriculum/steps'

const user = useState<User | null>('user')
const lessonId = useLessonId()

const key = computed(() =>
  user.value && lessonId.value ? `userSteps-${user.value.id}-${lessonId.value}` : 'userSteps-pending',
)

const { data: resSteps } = await useAsyncData(
  key,
  async () =>
    lessonId.value
      ? await stepsService.findAll({
          page: 1,
          limit: 10,
          lessonId: lessonId.value,
          sort: 'sortOrder:asc',
        })
      : null,
  { immediate: true, watch: [lessonId] },
)

const sidebarOpen = ref(false)

const steps = computed(() => resSteps.value?.data?.data ?? [])
</script>

<template>
  <NuxtLayout name="focus">
    <div class="rc-steps">
      <PlayButton
        variant="outline"
        size="sm"
        class="rc-steps__toggle"
        :aria-expanded="sidebarOpen"
        aria-controls="steps-list"
        @click="sidebarOpen = !sidebarOpen"
      >
        {{ sidebarOpen ? 'Tutup daftar langkah' : 'Daftar langkah' }}
      </PlayButton>

      <section v-if="sidebarOpen" id="steps-list" class="rc-steps__panel" aria-label="Daftar langkah">
        <div class="rc-steps__list">
          <StepLearningCollapsible
            v-for="value in steps"
            :key="value.id"
            :is-collapsible="true"
            :step-id="value.id"
            :step-title="value.title"
            :user-id="user?.id!"
          />
        </div>
      </section>

      <div class="rc-steps__content">
        <slot />
      </div>
    </div>
  </NuxtLayout>
</template>

<style>
.rc-steps {
  display: grid;
  gap: 1rem;
  align-items: start;
}
.rc-steps__toggle {
  justify-self: start;
}
.rc-steps__panel {
  padding: 1rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
}
.rc-steps__list {
  display: grid;
  gap: 0.75rem;
}
.rc-steps__content {
  min-width: 0;
}
</style>
