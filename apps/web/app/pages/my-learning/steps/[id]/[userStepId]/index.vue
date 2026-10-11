<script setup lang="ts">
import { computed, ref } from 'vue'
import Chatbot from '~/components/my-learning/Chatbot.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import RenderMarkdown from '~/components/ui/RenderMarkdown.vue'
import { userStepService } from '~/services/learning/userStep'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const userStepId = computed(() => String(route.params.userStepId || ''))

const { data: response, refresh } = await useAsyncData(
  () => `user-step-${userStepId.value}`,
  () => userStepService.findOne<true>(userStepId.value, { include: 'chat' }),
  { watch: [userStepId] },
)

const step = computed(() => response.value?.data ?? null)
const completing = ref(false)

useHead({ title: computed(() => `${step.value?.title ?? 'Langkah belajar'} | ReduCera`) })

async function complete() {
  if (!step.value || completing.value) return
  completing.value = true
  try {
    const result = await userStepService.complete(step.value.id)
    if (result.success) {
      await refresh()
      toast.add({ title: 'Langkah selesai', color: 'success', icon: 'i-lucide-check-circle' })
      return
    }
    toast.add({ title: 'Langkah belum bisa diselesaikan', description: 'Coba lagi sebentar lagi.', color: 'error' })
  } finally {
    completing.value = false
  }
}
</script>

<template>
  <div class="rc-stack rc-learning">
    <EmptyState
      v-if="!step"
      icon-name="i-lucide-file-question"
      title="Langkah tidak ditemukan"
      message="Langkah ini tidak ada atau bukan milikmu."
      cta-label="Kembali ke pelajaran"
      cta-to="/my-learning/steps"
    />

    <template v-else>
      <PageHeader :title="step.title">
        <template #actions>
          <PlayButton variant="outline" size="sm" @click="router.back()">Kembali</PlayButton>
        </template>
      </PageHeader>

      <PlayCard as="article" aria-labelledby="step-content">
        <h2 id="step-content" class="rc-h2">Materi</h2>
        <RenderMarkdown v-if="step.description" :text="step.description" />
        <p v-else class="rc-hint">Materi untuk langkah ini sedang disiapkan.</p>
      </PlayCard>

      <div class="rc-lessons__nav">
        <Chatbot v-if="step.chat?.id" :chat-id="step.chat.id" :user-step-id="step.id" />
        <PlayButton v-if="!step.isDone" :loading="completing" @click="complete">Tandai selesai</PlayButton>
        <p v-else class="rc-alert rc-alert--success" role="status">Langkah ini sudah selesai.</p>
      </div>
    </template>
  </div>
</template>
