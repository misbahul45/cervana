<script setup lang="ts">
import { useApi } from '~/composable/useApi';
import type { User } from '~/interfaces/auth';
import { chatMessageService } from '~/services/chat/chatMessages';
import { useAuth } from '~/stores/auth';

const props = defineProps<{
  chatId: string,
  userStepId: string
}>();

const showAiBot = ref(false);
const user=useState<User | null>('user')

const {
  data: resChatMessages,
  refresh: refreshChatMessages
} = await useAsyncData(
  `chat-messages-${props.chatId}`,
  () =>
    chatMessageService.findAll({
      chatId: props.chatId,
      page: 1,
      limit: 10000
    })
);

onMounted(() => {
  const eventSource = chatMessageService.listenChatMessages();

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.chatId === props.chatId) {
        refreshChatMessages();
      }
    } catch {}
  };

  onBeforeUnmount(() => {
    eventSource.close();
  });
});


const { call }=useApi(chatMessageService.create)
const auth=useAuth()
const messages = computed(() => resChatMessages.value?.data?.data || []);

const sendMessage=async()=>{
  await call({
    chatId: props.chatId,
    text: newMessage.value,
    role: 'USER',
    status: 'COMPLETED',
    userStepId: props.userStepId,
    userId: user.value?.id!
  },{
    access_token: auth.access_token!,
    refresh_token: auth.refresh_token!,
  })

  refreshChatMessages();
  newMessage.value=''
}

const newMessage = ref('');
</script>

<template>
  <UDrawer v-model:open="showAiBot" direction="right" :dismissible="false" :modal="false" :handle="false" class="no-scrollbar h-screen overflow-hidden">
    <UButton
      @click="showAiBot = true"
      icon="i-lucide-bot"
      size="lg"
      variant="solid"
      class="cursor-pointer  w-fit h-fit text-white"
    />

    <template #body>
      <div class="h-screen flex flex-col justify-between">
        <div class="flex items-start justify-between mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
            <div>
              <h2 class="text-lg font-semibold flex items-center gap-2 bg-linear-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient">
                <UIcon name="i-lucide-bot" class="text-primary" />
                CORE AI
              </h2>
              <p class="text-sm opacity-70 mt-1 leading-snug max-w-sm">
                Halo, aku CORE. Aku akan membantu semua misimu.
              </p>
            </div>
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-x"
              @click="showAiBot = false"
            />
          </div>

          <div class="w-full flex flex-col flex-1 justify-between pb-28">
            <div class="flex flex-1 flex-col overflow-auto gap-2">
              <div v-for="value in messages" :class="['flex w-full max-w-[90%] rounded-md shadow-md', value.role==='ASSISTANT'?'justify-start ':'justify-end ']">
                <div :class="['flex flex-col gap-1 w-64 p-2 rounded-lg shadow-xl shadow-white/5',  value.role==='ASSISTANT'?'bg-secondary/20':'bg-primary/20']">
                  <div v-if="value.role==='ASSISTANT'" class="flex items-center gap-2">
                    <UIcon name="i-lucide-bot" class="text-primary" />
                    <p class="text-xs">CORE AI</p>
                  </div>
                  <div v-else class="flex items-center gap-2 justify-start">
                    <UIcon name="i-lucide-user" class="text-primary" />
                    <p class="truncate text-xs">{{ user?.name }}</p>
                  </div>
                  <UiBotLoading v-if="value.status !== 'COMPLETED'" :text="value.text!" />
                  <p v-else :class="['text-xs', value.role === 'ASSISTANT'?'line-clamp-2':'']">{{ value.text }}</p>
                </div>
              </div>
            </div>
            <div class="fixed bg-[#030014] bottom-0 left-0 w-full p-2">
              <UTextarea
                v-model="newMessage"
                placeholder="Ketik pesanmu di sini..."
                class="w-full"
              />
              <UButton
                color="success"
                variant="outline"
                class="absolute top-1/2 -translate-y-1/2 right-6 z-20"
                @click="sendMessage"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <defs>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#22c55e" />
                    <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#22c55e" />
                  </filter>
                </defs>
                <path filter="url(#glow)" d="M2.5 19.5l19-7l-19-7v6l10 1l-10 1v6z"/>
              </svg>

            </UButton>
            <p class="text-xs mt-1">
              Tanyakan pada Core untuk bantu pembelajaranmu....
            </p>
            </div>
          </div>
      </div>
    </template>
  </UDrawer>
</template>