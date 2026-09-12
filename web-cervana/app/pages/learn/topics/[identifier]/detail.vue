<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import { toRupiah } from '~/lib/helper'
import { topicsService } from '~/services/curriculum/topics'
import { userTopicService } from '~/services/learning/userTopic'
import { ordersService } from '~/services/order'

const route = useRoute()
const router=useRouter()

const { data: resTopic } = await useAsyncData<ApiResponse<TopicDetailResponse<true>>>(
  `topic-${route.params.identifier}`,
  async () => topicsService.findOne(route.params.identifier as string, {})
)

const topic = computed(() => resTopic.value?.data)

const toPage = (identifier: string, type: 'order' | 'detail') => {
  router.push(`/learn/topics/${identifier}/${type}`)
}

const imageUrl=ref(topic.value?.image?.url)

const descriptionRef = ref<HTMLElement | null>(null)
const subTopicHeight = ref('auto')

const updateSubTopicHeight = () => {
  if (descriptionRef.value) {
    const height = descriptionRef.value.offsetHeight
    subTopicHeight.value = `${height}px` 
  } else {
    subTopicHeight.value = 'auto'
  }
}

const user = useState<User | null>('user')
let access_token: string | undefined
let refresh_token: string | undefined

const headers = useRequestHeaders(['cookie'])

if (headers?.cookie) {
  const cookieStr = headers.cookie
  access_token = cookieStr.match(/access_token=([^;]+)/)?.[1]
  refresh_token = cookieStr.match(/refresh_token=([^;]+)/)?.[1]
}

const toast=useToast()
const queryClient=useQueryClient()

const orderMutation = useMutation({
  mutationFn: async () => await ordersService.create(
    {
      userId: user.value?.id,
      topicId: topic.value?.id
    },
    { access_token, refresh_token }
  ),

  onSuccess: async (res) => {
   if(res.data?.status==='PAID'){
    queryClient.invalidateQueries({
      queryKey: ['userTopics', user.value?.id]
    })
    toast.add({
      title:'Successfully Unluck Topic',
      color:'success',
      icon:'i-lucide-rocket'
    })
   }
  }
})

const { data, isLoading:isLoadingUserTopic }=useQuery({
  queryKey:[topic.value?.id, user.value],
  queryFn:async()=>{
    return await userTopicService.findAll({
      page:1,
      limit:1,
      userId:user.value?.id,
      topicId:topic.value?.id
    })
  }
})


const userTopic=computed(()=>data.value?.data?.data || [])

const hasAccess = computed(() => {
  return userTopic.value.length > 0; 
});

onMounted(() => {
  updateSubTopicHeight()
  window.addEventListener('resize', updateSubTopicHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSubTopicHeight)
})

useHead(() => ({
  title: topic.value?.title
    ? `${topic.value.title} | Detail Topik Sertifikasi | CERVANA`
    : 'Detail Topik Sertifikasi | CERVANA',
  meta: [
    {
      name: 'description',
      content:
        topic.value?.description ||
        'Pelajari topik sertifikasi akuntansi berbasis AI dan gamifikasi. Tingkatkan kompetensi SMK Akuntansi sesuai standar SKKNI dan BNSP.',
    },
    {
      name: 'keywords',
      content:
        'CERVANA, topik sertifikasi, SMK Akuntansi, pembelajaran AI, gamifikasi, microlearning, sertifikasi BNSP, SKKNI',
    },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `https://cervana.ai${route.fullPath}` },
    {
      property: 'og:title',
      content:
        topic.value?.title
          ? `${topic.value.title} | CERVANA`
          : 'Detail Topik Sertifikasi | CERVANA',
    },
    {
      property: 'og:description',
      content:
        topic.value?.description ||
        'Temukan materi pembelajaran dan sertifikasi akuntansi berbasis AI & gamifikasi di platform CERVANA.',
    },
    { property: 'og:image', content: topic.value?.image?.url || '/meta/og-detail.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: topic.value?.title || 'Detail Topik Sertifikasi | CERVANA',
    },
    {
      name: 'twitter:description',
      content:
        topic.value?.description ||
        'Pelajari topik pembelajaran akuntansi untuk persiapan sertifikasi SMK dengan pendekatan AI dan gamifikasi.',
    },
    { name: 'twitter:image', content: topic.value?.image?.url || '/meta/og-detail.png' },
  ],
}))
</script>

<template>
  <div class="relative flex flex-col items-center lg:gap-6 md:gap-4 gap-3 pb-10 w-full max-w-6xl mx-auto">
  <div class="relative w-full overflow-hidden rounded-2xl shadow-2xl shadow-secondary/30 z-10">
    <NuxtImg
      :src="imageUrl"
      :alt="'image-' + topic?.title"
      class="w-full h-full object-cover lg:h-[85vh] md:h-[70vh] sm:h-[60vh]"
    />
    <div class="absolute inset-0 bg-linear-to-t from-black/60 via-black/30 to-transparent" />
    <div class="absolute bottom-6 left-6 text-white">
      <h1 class="text-xl md:text-3xl font-bold">{{ topic?.title }}</h1>
      <p class="text-sm opacity-80 mt-1">
        by {{ topic?.teacher?.name }} • {{ topic?.categories?.[0]?.name }}
      </p>
    </div>
  </div>

  <div class="flex flex-col-reverse gap-8 md:flex-row items-start md:gap-2 w-full">
    <div 
      class="w-full sticky top-6 overflow-y-auto no-scrollbar"
      :style="{ maxHeight: subTopicHeight, height: subTopicHeight === 'auto' ? 'auto' : 'fit-content' }"
    >
      <TopicsDetailMappingSubTopics :topic-id="topic?.id" />
    </div>

    <div 
      ref="descriptionRef" 
      class="max-w-4xl w-full space-y-8 px-4 z-20"
    >
      <article class="prose prose-invert max-w-none bg-black/10 md:backdrop-blur-lg md:bg-transparent">
        <div v-html="topic?.description"></div>
      </article>

      <div class="flex justify-between items-center gap-4 md:pt-6 sm:pt-4 pt-2 border-t border-white/10">
        <div class="flex items-center gap-3">
          <NuxtImg
            :src="topic?.teacher?.image?.url"
            :alt="topic?.teacher?.name"
            class="md:size-12 sm:size-10 size-8 rounded-full object-cover"
          />
          <div class="truncate">
            <p class="font-semibold md:text-base sm:text-sm text-[8px]">{{ topic?.teacher?.name }}</p>
            <p class="md:text-sm sm:text-[10px] text-[8px] opacity-70">Instructor</p>
          </div>
        </div>

        <UButton
          icon="i-lucide-rocket"
          variant="outline"
          :ui="{ leadingIcon:'text-warning animate-pulse' }"
          v-if="!(topic?.price===0)"
          :label="toRupiah(topic?.price)"
          size="lg"
          class="cursor-pointer text-white md:text-base sm:text-sm text-[10px] active:scale-95"
          @click="orderMutation.mutate()"
        />

        <UButton
          v-else
          icon="i-lucide-star"
          variant="outline"
          :disabled="isLoadingUserTopic || hasAccess"
          color="warning"
          :ui="{ leadingIcon: 'animate-bounce text-yellow-400' }"
          @click="toPage(topic?.id || '', 'order')"
          :label="hasAccess?'Already':'Launch'"
          size="lg"
          class="cursor-pointer md:text-base sm:text-sm text-[10px] font-bold uppercase active:scale-95"
        />
      </div>
    </div>
  </div>

  <div class="relative w-full">
    <TopicsMappingTopics />
  </div>

  <UiDownStarAnimation />
</div>
</template>