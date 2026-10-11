<script setup lang="ts">
import { useApi } from '~/composable/useApi';
import type { User } from '~/interfaces/auth';
import { chatMessageService } from '~/services/chat/chatMessages';

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
const messages = computed(() => resChatMessages.value?.data?.data || []);

const sendMessage=async()=>{
  await call({
    chatId: props.chatId,
    text: newMessage.value,
    role: 'USER',
    status: 'COMPLETED',
    userStepId: props.userStepId,
    userId: user.value?.id!
  })

  refreshChatMessages();
  newMessage.value=''
}

const newMessage = ref('');
</script>

<template>
  <UDrawer v-model:open="showAiBot" direction="right" :dismissible="false" :modal="false" :handle="false" :ui="{ content: 'rc-chat' }">
    <PlayButton variant="secondary" @click="showAiBot = true">
      <UIcon name="i-lucide-bot" aria-hidden="true" />
      Tanya CORE
    </PlayButton>

    <template #body>
      <div class="rc-chat__panel">
        <header class="rc-chat__header">
          <div>
            <h2 class="rc-chat__title">CORE</h2>
            <p class="rc-hint">Tanyakan apa pun tentang langkah ini.</p>
          </div>
          <PlayButton variant="ghost" size="sm" aria-label="Tutup percakapan" @click="showAiBot = false">Tutup</PlayButton>
        </header>

        <ul class="rc-chat__list" aria-live="polite">
          <li
            v-for="value in messages"
            :key="value.id"
            class="rc-chat__msg"
            :class="value.role === 'ASSISTANT' ? 'rc-chat__msg--bot' : 'rc-chat__msg--me'"
          >
            <p class="rc-chat__who">{{ value.role === 'ASSISTANT' ? 'CORE' : (user?.name ?? 'Kamu') }}</p>
            <UiBotLoading v-if="value.status !== 'COMPLETED'" :text="value.text!" />
            <p v-else class="rc-chat__text">{{ value.text }}</p>
          </li>
        </ul>

        <form class="rc-chat__form" @submit.prevent="sendMessage">
          <label class="rc-label" for="chat-input">Pesan</label>
          <textarea id="chat-input" v-model="newMessage" class="rc-field" rows="2" placeholder="Ketik pertanyaanmu"></textarea>
          <PlayButton type="submit" :disabled="!newMessage.trim()">Kirim</PlayButton>
        </form>
      </div>
    </template>
  </UDrawer>
</template>

<style>
.rc-chat {
  width: min(26rem, 100vw);
  border-left: 2px solid var(--rc-border);
  background-color: var(--rc-surface);
  color: var(--rc-fg);
}
.rc-chat__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100dvh;
  padding: 1rem;
}
.rc-chat__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--rc-border);
}
.rc-chat__title {
  margin: 0;
  font-size: 1.125rem;
}
.rc-chat__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.rc-chat__msg {
  max-width: 90%;
  padding: 0.625rem 0.875rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
}
.rc-chat__msg--bot {
  align-self: flex-start;
  background-color: color-mix(in srgb, var(--rc-secondary) 10%, var(--rc-surface));
}
.rc-chat__msg--me {
  align-self: flex-end;
  background-color: color-mix(in srgb, var(--rc-primary) 12%, var(--rc-surface));
}
.rc-chat__who {
  margin: 0 0 0.25rem;
  color: var(--rc-muted);
  font-size: 0.75rem;
  font-weight: 800;
}
.rc-chat__text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.rc-chat__form {
  display: grid;
  gap: 0.5rem;
}
</style>
