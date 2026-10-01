<script setup lang="ts">
import MainSubTopics from '~/components/my-learning/MainSubTopics.vue'
import { onMounted, onUnmounted, ref, inject } from 'vue'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import type { BaseSubTopic } from '~/interfaces/curriculum/subTopics'


const audio = ref<HTMLAudioElement | null>(null)
const isAudioPlaying = ref(false)
const isMuted = ref(true)
const targetVolume = 0.6

const isNightMode = ref(true)
const parallaxX = ref(0)
const parallaxY = ref(0)

const topic = inject('topic') as Ref<TopicDetailResponse<true> | undefined>
const subTopics = inject('subTopics') as Ref<BaseSubTopic[]> | undefined


const initializeAudio = () => {
  if (audio.value) return
  const newAudio = new Audio('/sounds/main-music.mp3')
  newAudio.loop = true
  newAudio.volume = 0
  newAudio.muted = true
  audio.value = newAudio
  playAudioWithFade()
}

const playAudioWithFade = async () => {
  if (!audio.value) return
  try {
    audio.value.muted = true
    await audio.value.play()
    isAudioPlaying.value = true
    isMuted.value = true
    setTimeout(() => {
      audio.value!.muted = false
      isMuted.value = false
      let v = 0
      const fade = setInterval(() => {
        v += 0.02
        audio.value!.volume = v
        if (v >= targetVolume) {
          audio.value!.volume = targetVolume
          clearInterval(fade)
        }
      }, 150)
    }, 300)
  } catch {}
}

const toggleAudio = () => {
  if (!audio.value) return
  if (isAudioPlaying.value) {
    audio.value.pause()
    isAudioPlaying.value = false
  } else {
    audio.value.play()
    audio.value.volume = targetVolume
    audio.value.muted = false
    isMuted.value = false
    isAudioPlaying.value = true
  }
}

const toggleDayNight = () => {
  isNightMode.value = !isNightMode.value
  document.documentElement.classList.toggle('day-mode', !isNightMode.value)
}

const handleMouseMove = (e: MouseEvent) => {
  parallaxX.value = (e.clientX / window.innerWidth - 0.5) * 20
  parallaxY.value = (e.clientY / window.innerHeight - 0.5) * 20
}

onMounted(() => {
  initializeAudio()
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (audio.value) {
    audio.value.pause()
    audio.value = null
  }
  window.removeEventListener('mousemove', handleMouseMove)
})

</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-black dark-space sm:px-6 px-4 md:px-10">
  
    <div class="star-twinkles"></div>

    <div class="meteors"></div>
    <div class="parallax layer stars-1" :style="{ transform: `translate(${parallaxX * 0.3}px, ${parallaxY * 0.3}px)` }"></div>
    <div class="parallax layer stars-2" :style="{ transform: `translate(${parallaxX * 0.5}px, ${parallaxY * 0.5}px)` }"></div>
    <div class="parallax layer twinkles" :style="{ transform: `translate(${parallaxX * 0.2}px, ${parallaxY * 0.2}px)` }"></div>

    <div class="parallax layer nebula purple" :style="{ transform: `translate(${parallaxX * 0.1}px, ${parallaxY * 0.1}px)` }"></div>
    <div class="parallax layer nebula blue" :style="{ transform: `translate(${parallaxX * 0.1}px, ${parallaxY * 0.1}px)` }"></div>
    <div class="parallax layer nebula pink" :style="{ transform: `translate(${parallaxX * 0.1}px, ${parallaxY * 0.1}px)` }"></div>

    <div class="parallax planet planet-1" :style="{ transform: `translate(${parallaxX * -0.2}px, ${parallaxY * -0.1}px)` }"></div>
    <div class="parallax planet planet-2" :style="{ transform: `translate(${parallaxX * 0.2}px, ${parallaxY * 0.3}px)` }"></div>
    <div class="parallax planet planet-3" :style="{ transform: `translate(${parallaxX * -0.3}px, ${parallaxY * 0.1}px)` }"></div>
    <div class="parallax planet planet-4" :style="{ transform: `translate(${parallaxX * 0.1}px, ${parallaxY * -0.3}px)` }"></div>

    <div class="fixed bottom-4 right-4 z-50 flex gap-2">
      <UButton
        :icon="isAudioPlaying ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
        color="secondary"
        variant="solid"
        size="sm"
        @click="toggleAudio"
      />
      <UButton
        :icon="isNightMode ? 'i-lucide-moon' : 'i-lucide-sun'"
        color="secondary"
        variant="solid"
        size="sm"
        @click="toggleDayNight"
      />
    </div>

    <div class="relative z-10">
      <MainSubTopics :subTopics="subTopics || []" :title="topic?.title" />
    </div>
    <UiSunset />
  </div>
</template>


<style>
.dark-space {
  background: radial-gradient(circle at center, #020617 0%, #000 100%);
}

.stars-1 {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  animation: drift 140s linear infinite;
}

.stars-2 {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  animation: drift 200s linear infinite reverse;
}

.twinkles {
  position: absolute;
  inset: 0;
  animation: sparkle 3s ease-in-out infinite;
  opacity: 0.8;
}

.star-twinkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 70% 60%, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 40% 80%, rgba(255,255,255,0.85), transparent),
                    radial-gradient(1px 1px at 90% 20%, rgba(255,255,255,0.6), transparent);
  animation: twinkle 5s infinite ease-in-out alternate;
  z-index: 2;
  opacity: 0.7;
  filter: brightness(1.3);
}

@keyframes twinkle {
  0% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.05); }
  100% { opacity: 0.4; transform: scale(1); }
}


/* NEBULA */
.nebula {
  position: absolute;
  inset: 0;
  filter: blur(100px);
}
.nebula.purple {
  background: radial-gradient(circle at 20% 20%, rgba(120, 60, 255, 0.25), transparent 60%);
}
.nebula.blue {
  background: radial-gradient(circle at 80% 25%, rgba(60, 120, 255, 0.25), transparent 70%);
}
.nebula.pink {
  background: radial-gradient(circle at 50% 80%, rgba(255, 70, 150, 0.2), transparent 70%);
}

/* PLANETS — only darker + glow corrected */
.planet {
  position: absolute;
  border-radius: 50%;
  box-shadow:
    inset -30px -30px 60px rgba(0, 0, 0, 0.85),
    0 0 80px rgba(255, 255, 255, 0.08);
  filter: brightness(0.7);
}

.planet-1 { width:150px; height:150px; top:5%; left:8%; background:#3b82f6; }
.planet-2 { width:100px; height:100px; top:60%; right:12%; background:#9333ea; }
.planet-3 { width:80px; height:80px; top:25%; right:25%; background:#ec4899; }
.planet-4 { width:130px; height:130px; bottom:15%; left:20%; background:#f97316; }

/* DAY MODE OVERRIDE */
:root.day-mode .dark-space {
  background: radial-gradient(circle at center, #0f172a 0%, #1e293b 100%);
}

:root.day-mode .nebula {
  opacity: 0.15;
  filter: blur(60px);
}

:root.day-mode .planet {
  filter: brightness(1);
}

.meteors {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 3;
}

.meteors::before,
.meteors::after {
  content: "";
  position: absolute;
  top: -50px;
  width: 2px;
  height: 80px;
  background: linear-gradient(180deg, white, rgba(255,255,255,0));
  opacity: 0.9;
  border-radius: 50%;
  transform: rotate(45deg);
  animation: meteorFall 4s linear infinite;
}

.meteors::after {
  left: 80%;
  animation-delay: 2s;
  transform: rotate(60deg);
  height: 100px;
}

@keyframes meteorFall {
  0% {
    transform: translateX(0) translateY(0) rotate(45deg);
    opacity: 0;
  }
  5% { opacity: 1; }
  100% {
    transform: translateX(-600px) translateY(600px) rotate(45deg);
    opacity: 0;
  }
}


/* ANIMATIONS */
@keyframes drift {
  from { transform: translate(0); }
  to { transform: translate(800px, 800px); }
}

@keyframes sparkle {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 0.3; }
}
</style>