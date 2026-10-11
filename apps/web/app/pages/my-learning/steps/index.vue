<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import type { User } from '~/interfaces/auth'
import { personalityQuizService } from '~/services/learning/personalityQuiz'
import { lessonProgressService } from '~/services/learning/lessonsProgress'
import { useApi } from '~/composable/useApi'
import { useLearning } from '~/stores/learning'
import { userStepService } from '~/services/learning/userStep'

const route = useRoute()
const user = useState<User | null>('user')
const learning = useLearning()
const { call } = useApi(lessonProgressService.update)
const isgenerating = ref(true)

const generatedOnce = ref(false)
const logs = ref<string[]>([])
const displayText = ref("")
let typingQueue: string[] = []
let typingTimer: any = null

function cleanText(data: string) {
  try {
    const json = JSON.parse(data)
    return json.message || json.content || json.text || data
  } catch {
    return data
  }
}

function pushToTypingQueue(newText: string) {
  typingQueue.push(...newText.split(''))
  processTyping()
}

function processTyping() {
  if (typingTimer || typingQueue.length === 0) return
  typingTimer = setInterval(() => {
    if (typingQueue.length === 0) {
      clearInterval(typingTimer)
      typingTimer = null
      return
    }
    displayText.value += typingQueue.shift()
  }, 10)
}

async function startGenerate() {
  if (generatedOnce.value) return

  // Reset state supaya tidak numpuk
  logs.value = []
  typingQueue = []
  displayText.value = ""
  isgenerating.value = true

  const eventSource = await personalityQuizService.generateStream(
    {
      lessonId: route.query.lessonId as string,
      topicId: learning.topicId,
      learningStyleId: learning.learningStyleId,
      userId: user.value?.id as string
    }
  )

  eventSource.addEventListener('status', (e) => {
    const raw = cleanText(e.data).trim().toLowerCase()
    const blockWords = ['generating', 'loading', 'processing', 'prepare', 'intro']
    if (blockWords.some(w => raw.includes(w))) return
    const text = cleanText(e.data) + "\n"
    logs.value.push(text)
    pushToTypingQueue(text)
  })

  eventSource.addEventListener('introduction_chunk', (e) => {
    const text = cleanText(e.data) + "\n"
    logs.value.push(text)
    pushToTypingQueue(text)
  })

  eventSource.addEventListener('end', async () => {
    eventSource.close()

    const finalText = logs.value.join('')

    // Simpan final saja (biar watcher read dari DB yg render lagi)
    const progress = await lessonProgressService.findAll({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      lessonId: route.query.lessonId
    })

    const progressId = progress?.data?.data?.[0]?.id
    if (progressId) {
      await call(progressId, { introduction: finalText })
    }

    generatedOnce.value = true
  })

  eventSource.onerror = () => {
    eventSource.close()
  }
}

const lessonId = computed(() => (typeof route.query.lessonId === 'string' ? route.query.lessonId : ''))

const { data: resQuiz } = await useAsyncData(
  () => `personality-quiz-${route.query.lessonId}`,
  () =>
    !lessonId.value ? null : personalityQuizService.findAll(
      {
        page: 1,
        limit: 1,
        userId: user.value?.id,
        lessonId: route.query.lessonId as string
      }
    )
)

const { data: resProgress } = await useAsyncData(
  () => `lesson-progress-${route.query.lessonId}`,
  () =>
    !lessonId.value ? null : lessonProgressService.findAll({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      lessonId: route.query.lessonId
    })
)


watch(
  () => resQuiz.value,
  (val) => {
    if (lessonId.value && !generatedOnce.value && val?.data?.data.length === 0 && !resProgress.value?.data?.data[0]?.introduction) {
      startGenerate()
    }
  },
  { immediate: true }
)

watch(
  () => resProgress.value,
  (newVal) => {
    const intro = newVal?.data?.data?.[0]?.introduction
    if (!intro) return

    if (typingTimer) {
      clearInterval(typingTimer)
      typingTimer = null
    }

    generatedOnce.value = true
    logs.value = []
    typingQueue = []
    displayText.value = intro
    isgenerating.value = false
  },
  { immediate: true }
)

watch(
  () => displayText.value,
  (val) => {
    if (val.length > 0) {
      isgenerating.value = false
    }
  }
)
</script>

<template>
  <div class="rc-stack rc-learning">
    <EmptyState
      v-if="!lessonId"
      icon-name="i-lucide-book-open"
      title="Pilih pelajaran dulu"
      message="Buka pelajaran dari jalur belajar, lalu tekan Mulai belajar."
      cta-label="Ke topik saya"
      cta-to="/learn/profile/my-learning"
    />
    <template v-else>
    <PageHeader title="Pengantar" subtitle="Ringkasan pelajaran ini dibuat khusus untuk gaya belajarmu." />

    <PlayCard as="section" aria-labelledby="intro-content">
      <h2 id="intro-content" class="rc-h2">Materi pengantar</h2>
      <div v-if="displayText.length === 0" class="rc-stepgroup__loading" aria-busy="true">
        <span v-for="value in 4" :key="value" class="rc-skel rc-skel--line"></span>
      </div>
      <UiRenderMarkdown v-else :text="displayText" />
    </PlayCard>

    <my-learning-personality-quiz />
    </template>
  </div>
</template>
