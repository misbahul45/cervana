<script setup lang="ts">
import { contentService } from '~/services/chat/contents'
import RenderMarkdown from '../ui/RenderMarkdown.vue'
import { onMounted, onBeforeUnmount, computed } from 'vue'

const props = defineProps<{ chatId: string }>()

const isLoading = ref(true)

const { data: resChhatContents, refresh: refreshChatContents } = await useAsyncData(
  `chat-contents-${props.chatId}`,
  () =>
    contentService.findAll({
      chatId: props.chatId,
      sort: 'createdAt:desc',
      page: 1,
      limit: 20
    })
)

const scrollToBottom = () => {
  const container = document.querySelector('#chat-content-container')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

const contents = computed(() => resChhatContents.value?.data?.data || [])

let es: EventSource | null = null

onMounted(() => {
  es = contentService.listenChatContent()

  es.onmessage =async(event)=>{
    try {
      const payload = JSON.parse(event.data)
      if (payload?.chatId === props.chatId) {
        refreshChatContents()
        await nextTick()
        scrollToBottom()
      }
    } catch (error) {}
  }
})

onBeforeUnmount(() => {
  es?.close()
})


watch(contents, (newVal) => {
  if (newVal.length) {
    isLoading.value = false
  }
}, { immediate: true }
)
</script>

<template>
  <div id="chat-content-container" class="space-y-4 h-full w-full max-w-8xl no-scrollbar overflow-y-auto">
    <div
      v-for="(value, index) in contents"
      :key="value.id"
      :class="['flex-1 h-fit w-full no-scrollbar overflow-y-auto md:p-4 p-2.5 border rounded-xl', index % 2 === 0?'border-secondary/80':'border-primary/80']"
    >
      <article
        class="prose w-full font-ubuntu rounded-xl max-w-full h-fit overflow-x-auto mx-auto prose-invert"
      >
        <RenderMarkdown :text="value.data" />
      </article>
    </div>
    <ui-loading v-if="isLoading" size="lg" />
  </div>
</template>
