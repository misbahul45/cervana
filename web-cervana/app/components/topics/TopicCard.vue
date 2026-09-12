<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import type {  User } from '~/interfaces/auth';
import type { BaseTopic } from '~/interfaces/curriculum/topics';
import { OrderStatus } from '~/interfaces/order';
import { toRupiah } from '~/lib/helper';
import { userTopicService } from '~/services/learning/userTopic';
import { ordersService } from '~/services/order';


const queryClient = useQueryClient()

const router = useRouter()
const props = defineProps<BaseTopic & { index: number, isLoading: boolean }>()

const toPage = (id: string, type: 'order' | 'detail') => {
  console.log('clicl')
  router.push(`/learn/topics/${id}/${type}`)
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

const { data, isLoading:isLoadingUserTopic,refetch }=useQuery({
  queryKey:[props.id, user.value],
  queryFn:async()=>{
    return await userTopicService.findAll({
      page:1,
      limit:1,
      userId:user.value?.id,
      topicId:props.id
    })
  }
})


const userTopicsData = computed(() => data.value?.data?.data || []);

const hasAccess = computed(() => {
  return userTopicsData.value.length > 0; 
});

const orderMutation = useMutation({
  mutationFn: async () => {
    if (!user.value) {
      navigateTo('/login', { replace: true })
      return { data:{
          status:OrderStatus.FAILED
        } 
      }
    }

    return await ordersService.create(
      {
        userId: user.value.id,
        topicId: props.id
      },
      { access_token, refresh_token }
    )
  },

  onSuccess: async (res) => {
    if (res?.data?.status === OrderStatus.PAID) {
      queryClient.invalidateQueries({
        queryKey: ['userTopics', user.value?.id]
      })

      refetch()

      toast.add({
        title: 'Successfully Unlock Topic',
        color: 'success',
        icon: 'i-lucide-rocket'
      })
    }
  }
})


const tooltipText = computed(() => {
  const count = props.userTopicsCount ?? 0
  return count > 0 ? `+${count} Heroes Rise` : 'No Heroes Yet'
})


const goLearn = () => {
  if (!user.value) {
    navigateTo('/login')
  }else{
    if (hasAccess.value) {
      navigateTo(`/my-learning/topics/${props.slug}`)
    } else {
      orderMutation.mutate()
    }
  }
}

</script>

<template>
  <div
    class="md:space-y-3 sm:space-y-2 space-y-1 border border-secondary/50 hover:border-secondary/70 bg-background/5 shadow-secondary/20 relatie shadow-2xl backdrop-blur-md md:p-2 sm:p-1 p-0.5 rounded-xl hover:shadow-secondary/80 transition-all duration-200 group"
  >
    <UTooltip :text="tooltipText" >
      <UBadge
        variant="solid"
        color="secondary"
        icon="i-lucide-chart-no-axes-combined"
        :ui="{ leadingIcon: 'text-primary' }"
        :label="props.ordersCount"
        class="text-[10px] backdrop-blur-sm absolute md:top-6 sm:top-5 top-3 md:right-6 sm:right-5 right-3 text-white z-20"
      />
    </UTooltip>

    <UBadge
      variant="solid"
      color="warning"
      v-if="props.price == 0"
      class="animate-pulse overflow-hidden absolute md:top-6 sm:top-5 top-3 md:left-6 sm:left-5 left-3"
    >
      Free
    </UBadge>

    <NuxtImg
      :src="props.image?.url || `https://picsum.photos/300/${200 + (props.index % 6) * 30}?random=${props.index}`"
      :alt="props.title"
      class="w-full h-44 md:h-56 object-cover rounded-lg shadow shadow-white/10"
    />
    <h3 class="md:text-base sm:text-sm text-[10px] text-dark font-semibold truncate w-full block">
      {{ props.title }}
    </h3>
    <div class="flex gap-2 items-center justify-between">
      <div class="p-3 flex-1 min-w-0 space-y-1.5">
        <p class="text-[10px] text-secondary/30 md:text-sm group-hover:text-secondary/90">
          {{ toRupiah(props.price) }}
        </p>
        <div class="flex gap-1 flex-wrap items-center">
          <UBadge
            v-for="value in props.categories"
            :key="value.id"
            :label="value.name"
            variant="outline"
            class="sm:text-[7px] text-[6px] md:text-[8px] p-1"
          />
        </div>
      </div>

      <div class="w-1/3 flex flex-col items-center">

        <div v-if="props.isLoading" class="w-10 h-10 rounded-full bg-white/10 animate-pulse" />

        <ClientOnly v-else>
          <UAvatar
            v-if="props.teacher?.image?.url"
            :src="props.teacher.image.url"
            :alt="props.teacher?.name"
            size="md"
          />
          <UAvatar
            v-else
            :alt="props.teacher?.name"
            size="md"
          />
        </ClientOnly>

        <p class="md:text-base sm:text-sm text-[8px] truncate max-w-[52px]">
          {{ props.teacher?.name || (props.isLoading ? '...' : 'Tanpa Nama') }}
        </p>

      </div>


    </div>

    <div class="flex items-center justify-between mt-3 px-2">
      <UButton
        icon="i-lucide-orbit"
        variant="outline"
        label="Detail"
        size="xs"
        class="cursor-pointer w-fit md:text-base sm:text-sm text-[10px] active:scale-95"
        @click="toPage(props.slug, 'detail')"
      />
      <UButton
        icon="i-lucide-rocket"
        :label="hasAccess?'Belajar':'Unlock'"
        :disabled="isLoadingUserTopic"
        size="xs"
        :ui="{
          leadingIcon:hasAccess?'animate-pulse text-secondary':''
        }"
        :color="hasAccess?'secondary':'primary'"
        :variant="hasAccess?'soft':'solid'"
        class="ml-1 cursor-pointer w-fit text-white md:text-base sm:text-sm text-[10px]"
        @click="goLearn"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes shine {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shine {
  animation: shine 0.5s linear infinite;
}
</style>
