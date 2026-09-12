<script setup lang="ts">
import { useApi } from '~/composable/useApi';
import { UserTopicStatus } from '~/interfaces/learning/userTopic';
import { userTopicService } from '~/services/learning/userTopic';

const props = defineProps<{
  userId: string | undefined
}>()

const page = ref(1)
const limit = 4

const queryKey = computed(() => ['userTopics', props.userId, page.value])

const { data: resUserTopic, isLoading } = useQuery({
  queryKey,
  queryFn: () =>
    userTopicService.findAll({
      userId: props.userId,
      page: page.value,
      limit,
      include: 'topic',
    }),
  enabled: computed(() => !!props.userId),
  refetchOnWindowFocus: false,
})
const { call }=useApi(userTopicService.update)

const userTopics = computed(() => resUserTopic.value?.data?.data ?? [])
const total = computed(() => resUserTopic.value?.data?.pagination.total ?? 0)
const maxPage = computed(() => Math.ceil(total.value / limit))

const nextPage = () => {
  if (page.value < maxPage.value) page.value++
}
const prevPage = () => {
  if (page.value > 1) page.value--
}

const goToTopic = (slug: string, id:string ,status:UserTopicStatus) => {
  if (!slug && !status) return

  if(status === UserTopicStatus.NOT_STARTED){
    call(id,{
      status:UserTopicStatus.IN_PROGRESS,
    })
  }
  navigateTo(`/my-learning/topics/${slug}`)
}

const totalCompleted = computed(() =>
  userTopics.value.filter(t => t.status === 'COMPLETED' || t.progressPercent === 100).length
)
</script>

<template>
  <USlideover title="Quick Learning">
    <UButton
      :label="`${totalCompleted} / ${total}`"
      icon="i-heroicons-play-circle-16-solid"
      color="primary"
      variant="ghost"
      size="sm"
      class="cursor-pointer"
    />

    <template #body>
      <div v-if="userTopics.length>0" class="grid grid-cols-1 gap-3 relative">

        <UiDownStarAnimation />

        <template v-if="isLoading">
          <div
            v-for="n in 6"
            :key="n"
            class="rounded-2xl bg-white/10 p-3 border border-white/10"
          >
            <USkeleton class="h-28 w-full rounded-xl mb-3" />
            <USkeleton class="h-4 w-2/3 mb-2" />
            <USkeleton class="h-3 w-1/4 mb-2" />
            <USkeleton class="h-2 w-full" />
          </div>
        </template>
        <template v-else>
          <div
            v-for="item in userTopics"
            :key="item.id"
            class="relative cursor-pointer overflow-hidden rounded-2xl group
                  bg-linear-to-br from-primary/30 via-secondary/10 to-black/40
                  border border-white/10 shadow-sm hover:shadow-lg
                  transition-all duration-500 hover:-translate-y-1"
          >
            <div
              class="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=800&q=60')] 
                      bg-cover bg-center mix-blend-overlay pointer-events-none"
            ></div>

            <div class="absolute inset-0 rounded-2xl border border-primary/30 group-hover:border-secondary/40 transition-all duration-500"></div>

            <div class="relative flex flex-col h-full">
              <NuxtImg
                :src="item.topic?.image?.url"
                class="w-full h-24 sm:h-32 object-cover rounded-t-2xl opacity-90 
                      group-hover:opacity-100 transition-all duration-300"
              />

              <UButton
                icon="i-fontisto-paper-plane"
                color="secondary"
                size="lg"
                variant="solid"
                class="absolute top-2 right-2 transition-all duration-300 cursor-pointer"
                @click.stop="goToTopic(item.topic?.slug!, item.id, item.status)"
              />

              <div class="flex flex-col gap-2 p-2 sm:p-3">
                <div class="flex items-center gap-2">
                  <NuxtIcon
                    name="ph:planet-duotone"
                    class="text-primary text-lg sm:text-xl group-hover:rotate-12 transition-transform duration-500"
                  />
                  <div class="font-semibold text-xs sm:text-sm text-white drop-shadow-md line-clamp-2 leading-tight">
                    {{ item.topic?.title }}
                  </div>
                </div>

                <UBadge
                  :label="item.accessType"
                  color="primary"
                  variant="soft"
                  class="w-fit text-[10px] tracking-wide"
                />

                <div class="text-[11px] sm:text-[12px] text-secondary font-medium">
                  {{ item.progressPercent }}% completed
                </div>

                <div class="w-full h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    class="h-full bg-linear-to-r from-primary via-secondary to-primary rounded-full transition-all"
                    :style="{ width: item.progressPercent + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Pagination -->
        <div class="flex justify-between items-center mt-4">
          <UButton
            label="Prev"
            icon="i-heroicons-chevron-left-20-solid"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="page === 1 || isLoading"
            @click="prevPage"
          />

          <div class="text-xs text-white/70">
            Page {{ page }} / {{ maxPage }}
          </div>

          <UButton
            label="Next"
            icon-right="i-heroicons-chevron-right-20-solid"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="page === maxPage || isLoading"
            @click="nextPage"
          />
        </div>
      </div>
      <div v-else class="h-screen relative flex justify-center items-center">
        <h2 class="text-sm font-semibold text-gray-700 animate-pulse">Hmm… sepertinya Universe-mu masih kosong</h2>
        <UiDownStarAnimation />
      </div>
    </template>
  </USlideover>
</template>
