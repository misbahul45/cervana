<script setup lang="ts">
import { ref, computed, watch, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import HeaderMyLearning from '~/components/layout/HeaderMyLearning.vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import type { UserTopicListResponse } from '~/interfaces/learning/userTopic'
import { UserTopicStatus } from '~/interfaces/learning/userTopic'
import { topicsService } from '~/services/curriculum/topics'
import { userTopicService } from '~/services/learning/userTopic'
import { useAuth } from '~/stores/auth'
import { useLearning } from '~/stores/learning'

const route = useRoute()
const toaster = { duration: 4000 }

const isTransitioning = ref(true)
const isClosing = ref(false)
const showPage = ref(false)
const transitionSound = ref<HTMLAudioElement | null>(null)
const showModal = ref(false)

const user = useState<User | null>('user')

const { data: resTopic, refresh:refreshTopic } = await useAsyncData<ApiResponse<TopicDetailResponse<true>>>(
  `topic-${route.params.slug}`,
  async () =>
    topicsService.findOne(route.params.slug as string, {
      include: ['subTopics']
    })
)

const topic = computed(() => resTopic.value?.data)
const subTopics = computed(() => topic.value?.subTopics || [])
const authStore=useAuth()
const learning=useLearning()

const access_token = authStore.access_token
const refresh_token = authStore.refresh_token

const { data: resUserTopic, refresh:refreshUserTopic } = await useAsyncData<ApiResponse<UserTopicListResponse>>(
  `userTopic-${user.value?.id}`,
  async () =>
    userTopicService.findAll(
      {
        page: 1,
        limit: 1,
        userId: user.value?.id,
        topicId: topic.value?.id,
        include:'learningStyleProfile',
      },
      {
        access_token,
        refresh_token
      }
    )
)

const userTopic = computed(() => resUserTopic.value?.data?.data?.[0])

const modalOpen = computed({
  get: () => showModal.value && !isTransitioning.value,
  set: (val) => {
    showModal.value = val
  }
})

watch(
  userTopic,
  () => {
    if (userTopic.value?.status === UserTopicStatus.NOT_STARTED) {
      showModal.value = true
    }
  },
  { immediate: true }
)

provide('topic', topic)
provide('subTopics', subTopics)

const playTransition = () => {
  if (transitionSound.value) {
    transitionSound.value.currentTime = 0
    transitionSound.value.play().catch(() => {})
  }

  showPage.value = false
  isClosing.value = false
  isTransitioning.value = true

  setTimeout(() => {
    isTransitioning.value = false
    isClosing.value = true
  }, 1400)

  setTimeout(() => {
    isClosing.value = false
    showPage.value = true
  }, 2400)
}

onMounted(async () => {
  transitionSound.value = document.getElementById('transition-sound') as HTMLAudioElement

  await refreshTopic()
  await refreshUserTopic()

  if (topic.value?.id) learning.setTopic(topic.value.id)
  if (userTopic.value?.learningStyleProfile?.id) learning.setLearningStyle(userTopic.value.learningStyleProfile.id)

  playTransition()
})

watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (newPath !== oldPath) {
      playTransition()
    }
  }
)

</script>

<template>
  <UApp :toaster="toaster">
    <div class="app-wrapper">
      <audio id="transition-sound" src="/sounds/open-music.mp3" preload="auto"></audio>

      <div class="transition-overlay transition-tl" :class="{ active: isTransitioning, closing: isClosing }">
        <div class="nebula-layer nebula-back"></div>
        <div class="nebula-layer nebula-mid"></div>
        <div class="meteor meteor-1"></div>
        <div class="rift-line"></div>
        <div class="rune-glyph"></div>
      </div>

      <div class="transition-overlay transition-br" :class="{ active: isTransitioning, closing: isClosing }">
        <div class="nebula-layer nebula-front"></div>
        <div class="meteor meteor-2"></div>
        <div class="meteor meteor-3"></div>
        <div class="rift-line"></div>
        <div class="rune-glyph"></div>
      </div>

      <div v-if="showPage" class="content-wrapper">
        <HeaderMyLearning :topicId="topic?.id || ''" />
        <slot />
      </div>

      <UModal fullscreen v-model:open="modalOpen">
        <template #content>
          <div class="w-full h-full flex flex-col items-center justify-center px-4 py-10 relative">
            <h1 class="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              Kenali Gaya Belajar Kamu
            </h1>

            <p class="text-base md:text-lg text-gray-300 text-center max-w-2xl mb-8">
              Form ini sangat penting untuk menentukan gaya belajar kamu ke depannya. 
              Dengan memahami cara belajar yang paling cocok buat kamu, sistem akan 
              menyesuaikan materi agar lebih mudah dipahami, lebih nyaman, dan lebih efektif.
            </p>

            <MyLearningStyleForm @success="showModal = false" :userTopicId="userTopic?.id!" />
          </div>
          <UiDownStarAnimation />
        </template>
      </UModal>
    </div>
  </UApp>
</template>

<style>
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}
.app-wrapper {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}
.content-wrapper {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  animation: contentFade 0.5s ease;
}
@keyframes contentFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.transition-overlay {
  position: fixed;
  z-index: 99999;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #010014 0%, #000215 25%, #000113 45%, #00000b 65%);
  background-image:
    radial-gradient(circle at 45% 30%, rgba(0,180,255,0.08), transparent 60%),
    radial-gradient(circle at 65% 60%, rgba(150,0,255,0.05), transparent 65%);
  transition: clip-path 1.4s cubic-bezier(0.77, 0, 0.175, 1);
  overflow: hidden;
  pointer-events: none;
}
.transition-tl { clip-path: polygon(0 0, 0 0, 0 0); }
.transition-br { clip-path: polygon(100% 100%, 100% 100%, 100% 100%); }
.transition-overlay.active.transition-tl { clip-path: polygon(0 0, 100% 0, 0 100%); }
.transition-overlay.active.transition-br { clip-path: polygon(100% 100%, 100% 0, 0 100%); }
.transition-overlay.closing.transition-tl { clip-path: polygon(0 0, 0 0, 0 0); }
.transition-overlay.closing.transition-br { clip-path: polygon(100% 100%, 100% 100%, 100% 100%); }
.nebula-layer {
  position: absolute;
  width: 200%;
  height: 200%;
  filter: blur(110px);
  opacity: 0.34;
  animation: nebulaFlow 38s ease-in-out infinite alternate;
}
.nebula-back {
  background: radial-gradient(circle at 20% 20%, rgba(50, 0, 120, 0.6), rgba(10, 0, 40, 0.9), transparent 60%);
}
.nebula-mid {
  background: conic-gradient(from 100deg, rgba(0, 210, 255, 0.22), rgba(0, 150, 230, 0.12), transparent 60%);
}
.nebula-front {
  background: conic-gradient(from 240deg, rgba(120, 0, 255, 0.18), rgba(0, 230, 255, 0.14), rgba(0, 150, 255, 0.10), transparent 70%);
}
@keyframes nebulaFlow {
  0% { transform: translate(-60px, -60px) scale(1.15); }
  100% { transform: translate(60px, 60px) scale(1.33); }
}
.meteor {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #00caff;
  box-shadow: 0 0 22px #00aaff;
  opacity: 0.9;
  transform: rotate(45deg);
  animation: meteorFall 1.18s linear infinite;
}
.meteor-1 { top: -20px; left: 35%; animation-delay: 0s; }
.meteor-2 { top: -40px; left: 60%; animation-delay: .7s; }
.meteor-3 { top: -55px; left: 80%; animation-delay: 1.4s; }
@keyframes meteorFall {
  0% { transform: translate(0, 0) rotate(45deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(-480px, 480px) rotate(45deg); opacity: 0; }
}
.rift-line {
  position: absolute;
  width: 80%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.7), rgba(150, 0, 255, 0.7), rgba(0, 200, 255, 0.7), transparent);
  filter: drop-shadow(0 0 25px #00d4ff);
  opacity: 0.9;
  animation: riftPulse 1.05s ease-in-out infinite alternate;
}
@keyframes riftPulse {
  0% { transform: scaleX(0.4); opacity: 0.35; }
  100% { transform: scaleX(1.8); opacity: 1; }
}
.rune-glyph { display: none; }
</style>
