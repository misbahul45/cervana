<script setup lang="ts">
import type { User } from '~/interfaces/auth';
import { userStepService } from '~/services/learning/userStep';
import { material } from '~/constants';
import MarkdownIt from 'markdown-it';
import type { ApiResponse } from '~/interfaces/api';
import type { UserStep, UserStepDetailResponse } from '~/interfaces/learning/userSteps';
import { useApi } from '~/composable/useApi';

const route=useRoute()

const { data:resUserStep }=await useAsyncData<ApiResponse<UserStepDetailResponse<true>>>(
  `user-step-${route.params.userStepId}`,
  () =>
    userStepService.findOne(route.params.userStepId as string,{
      include:'chat'
    })
)


// const { data: authData, } = await useAsyncData<{
//   accessToken:string;
//   refreshToken:string;
//   user:User;
// }>('me', () =>
//   $fetch('/api/auth/me')
// )
// const accessToken = computed(() => authData.value?.accessToken)
// const refreshToken = computed(() => authData.value?.refreshToken)
// const user = computed(() => authData.value?.user)

const toast=useToast()

const { call }=useApi(userStepService.complete)

const GoNextUserStep=async()=>{
  await call(route.params.userStepId as string)
  toast.add({
    title:"🔥 Level up: Understanding +1",
    color:'warning'
  })
}

</script>

<template>
<div class="w-full flex flex-col gap-2 h-full relative rounded-lg p-2 md:px-6 md:py-4 backdrop-blur-sm">
  <my-learning-reader-all-content :chat-id="resUserStep?.data?.chat?.id!" />
  <div class="flex justify-between items-center px-6">
    <u-button v-if="resUserStep?.success" @click="GoNextUserStep" variant="outline" trailing-icon="i-lucide-check" color="success" class="w-fit cursor-pointer">Saya Paham</u-button>
    <my-learning-chatbot :chat-id="resUserStep?.data?.chat?.id!" :user-step-id="route.params.userStepId! as string" />
  </div>
</div>  
</template>