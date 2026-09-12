<script  setup lang="ts">
import type { User } from '~/interfaces/auth';
import { userTopicService } from '~/services/learning/userTopic';
import { useAuth } from '~/stores/auth';
import { useLearning } from '~/stores/learning';

  const user=useState<User>('user')
  const auth=useAuth()
  const learning=useLearning()


  const { data }=await useAsyncData(
    `userTopic-${user.value.id}`,
    ()=>{
      return userTopicService.findAll({
        page:1,
        limit:1,
        userId:user.value.id,
        topicId:learning.topicId
      },{
        access_token:auth.access_token,
        refresh_token:auth.refresh_token
      })
    }
  )

  watch(data, (newVal)=>{
    if(newVal?.data?.data.length==0){
      navigateTo('/app//topics')
    }
  })
</script>
<template>
  <NuxtLayout name="steps">
    <NuxtPage />
  </NuxtLayout>
</template>
