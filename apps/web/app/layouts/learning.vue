<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import { UserTopicStatus, type UserTopicListResponse } from '~/interfaces/learning/userTopic'
import { topicsService } from '~/services/curriculum/topics'
import { userTopicService } from '~/services/learning/userTopic'
import { useLearning } from '~/stores/learning'

const route = useRoute()
const user = useState<User | null>('user')
const learning = useLearning()
const showModal = ref(false)

const { data: resTopic, status: topicStatus } = await useAsyncData<ApiResponse<TopicDetailResponse<true>> | null>(
  `learning-topic-${route.params.slug}`,
  async () =>
    route.params.slug
      ? topicsService.findOne(route.params.slug as string, { include: ['subTopics'] })
      : null,
)

const topic = computed(() => resTopic.value?.data)
const subTopics = computed(() => topic.value?.subTopics || [])

const { data: resUserTopic } = await useAsyncData<ApiResponse<UserTopicListResponse>>(
  `learning-user-topic-${user.value?.id}-${route.params.slug}`,
  async () =>
    userTopicService.findAll({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      topicId: topic.value?.id,
      include: 'learningStyleProfile',
    }),
)

const userTopic = computed(() => resUserTopic.value?.data?.data?.[0])

const modalOpen = computed({
  get: () => showModal.value,
  set: (value) => {
    showModal.value = value
  },
})

watch(
  userTopic,
  () => {
    if (userTopic.value?.status === UserTopicStatus.NOT_STARTED) {
      showModal.value = true
    }
  },
  { immediate: true },
)

watch(
  [topic, userTopic],
  () => {
    if (topic.value?.id) learning.setTopic(topic.value.id)
    if (topic.value?.slug) learning.setTopicSlug(topic.value.slug)
    if (userTopic.value?.learningStyleProfile?.id) learning.setLearningStyle(userTopic.value.learningStyleProfile.id)
  },
  { immediate: true },
)

provide('topic', topic)
provide('subTopics', subTopics)
provide('topicStatus', topicStatus)
</script>

<template>
  <AppShell>
    <slot />

    <UModal v-model:open="modalOpen" :ui="{ content: 'rc-learning-modal' }">
      <template #content>
        <div class="rc-learning-modal__body">
          <h2 class="rc-learning-modal__title">Kenali gaya belajarmu</h2>
          <p class="rc-learning-modal__text">
            Jawab beberapa pertanyaan singkat. Hasilnya menyesuaikan cara materi disajikan supaya lebih mudah kamu pahami.
          </p>
          <MyLearningStyleForm :userTopicId="userTopic?.id!" @success="showModal = false" />
        </div>
      </template>
    </UModal>
  </AppShell>
</template>

<style>
.rc-learning-modal {
  max-width: 36rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  color: var(--rc-fg);
}
.rc-learning-modal__body {
  display: grid;
  gap: 1rem;
  max-height: 85vh;
  padding: 1.5rem;
  overflow-y: auto;
}
.rc-learning-modal__title {
  margin: 0;
  font-size: 1.375rem;
}
.rc-learning-modal__text {
  margin: 0;
  color: var(--rc-muted);
}
</style>
