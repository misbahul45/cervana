<script setup lang="ts">
import { computed, ref } from 'vue'
import Sunset from '~/components/ui/Sunset.vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { BaseLesson } from '~/interfaces/curriculum/lessons'
import type { NavigationSubTopicResponse } from '~/interfaces/curriculum/subTopics'
import { LearningStatus, type SubTopicProgress } from '~/interfaces/learning/subTopicProgress'
import { subTopicsService } from '~/services/curriculum/subTopics'
import { subTopicProgressService } from '~/services/learning/subTopicProgress'
import { useLearning } from '~/stores/learning'

const route = useRoute()
const user = useState<User | null>('user')
const learning=useLearning()

const { data: resNavigation } = await useAsyncData<ApiResponse<NavigationSubTopicResponse<true>>>(
  `subTopic-navigation-${route.params.id}`,
  async () => subTopicsService.findNavigation(route.params.id as string)
)

const navigation = computed(() => resNavigation.value?.data || null)
const subTopic = computed(() => navigation.value?.current || null)
const nextSubTopic = computed(() => navigation.value?.next || null)
const prevSubTopic = computed(() => navigation.value?.previous || null)


const lessons = computed<BaseLesson[]>(() => subTopic.value?.lessons || [])

const completedLessonIds = computed(() => {
  const progressData = resSubTopicProgress.value?.data?.data || []
  return progressData.map((progress: SubTopicProgress) => 
    typeof progress === 'string' ? progress : progress.id
  )
})



const hasLearning = (id: string) => completedLessonIds.value.includes(id)
const isLessonUnlocked = (lesson: BaseLesson, index: number) => index === 0 || hasLearning(lessons.value[index - 1]?.id || '')

const router = useRouter()
const showDescription = ref(false)
const toggleDescription = () => { showDescription.value = !showDescription.value }
const goTo = (id: string, isUnlocked: boolean) => { 
  if (isUnlocked) {
    learning.setLesson(id)


    router.push(`/my-learning/lessons/${id}`)
  }
 }

const auroraBg = computed(() => `
  radial-gradient(ellipse 120% 80% at 50% -20%, ${subTopic.value?.theme?.primary}65 0%, transparent 50%),
  radial-gradient(ellipse 100% 100% at 15% 30%, ${subTopic.value?.theme?.secondary}50 0%, transparent 60%),
  radial-gradient(ellipse 100% 100% at 85% 40%, ${nextSubTopic.value?.theme?.primary}45 0%, transparent 65%),
  radial-gradient(ellipse 80% 60% at 50% 80%, ${nextSubTopic.value?.theme?.secondary}40 0%, transparent 70%),
  linear-gradient(180deg, #050616 0%, #0c1127 40%, #06091a 100%)
`)

const planetStyles = ['satellite', 'ring', 'asteroid', 'moon', 'comet']
const randomStyle1 = ref(planetStyles[Math.floor(Math.random() * planetStyles.length)])
const randomStyle2 = ref(planetStyles.filter(s => s !== randomStyle1.value)[Math.floor(Math.random() * (planetStyles.length - 1))])


const { data: resSubTopicProgress } = await useAsyncData(
  `subTopic-progresses-${user.value?.id}`,
  async () =>
    subTopicProgressService.findAll({
      page: 1,
      limit: 100,
      userId: user.value?.id,
      subTopicId: route.params.id
    })
)

if ((resSubTopicProgress.value?.data?.data.length ?? 0) === 0) {
  await subTopicProgressService.create({
    userId: user.value!.id,
    subTopicId: String(route.params.id),
    progress: 0,
    completed: false,
    status: LearningStatus.IN_PROGRESS
  })
}

watch(() => route.params.id, (newId) => {
  if (newId) {
    learning.setSubTopic(String(newId));
  }
}, { immediate: true });
</script>


<template>
  <div class="relative w-full flex py-16 min-h-screen items-center justify-center">
    <div class="absolute inset-0" :style="{ background: auroraBg }"></div>
    <div class="stars"></div>
    <div class="stars-layer-2"></div>
    <div class="absolute inset-0 backdrop-blur-[1px]"></div>
    
    <div class="planet-container top-[10%] left-[10%]">
      <div
        class="parallax planet size-40"
        :style="{ 
          backgroundColor: subTopic?.theme?.primary,
          '--planet-color': subTopic?.theme?.primary 
        }"
      />
      <div 
        :class="['orbital-element', randomStyle1]"
        :style="{ '--element-color': subTopic?.theme?.primary }"
      ></div>
    </div>
    
    <div class="planet-container bottom-[10%] right-[10%]">
      <div
        class="parallax planet planet-dark size-40"
        :style="{ 
          backgroundColor: nextSubTopic?.theme?.primary,
          '--planet-color': nextSubTopic?.theme?.primary 
        }"
      />
      <div 
        :class="['orbital-element', randomStyle2]"
        :style="{ '--element-color': nextSubTopic?.theme?.primary }"
      ></div>
    </div>


    <div class="relative z-20 flex flex-col items-center justify-center px-4 md:px-6 mx-auto">
      <div class="text-center mb-6 md:mb-10 max-w-2xl w-full">
        <div class="flex flex-col md:flex-row items-center justify-center gap-3 mb-4 px-4">
          <h1 class="text-white text-xl md:text-2xl font-bold font-orbitron line-clamp-2 md:line-clamp-1">
            {{ subTopic?.title }}
          </h1>

          <UButton
            v-if="subTopic?.description"
            @click="toggleDescription"
            variant="solid"
            color="primary"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 hover:scale-105 shrink-0"
          >
            <Icon 
              :name="showDescription ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" 
              class="w-4 h-4 text-white transition-transform duration-300" 
            />
          </UButton>
        </div>

        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-2 max-h-0"
          enter-to-class="opacity-100 translate-y-0 max-h-[500px]"
          leave-active-class="transition-all duration-300 ease-in"
          leave-from-class="opacity-100 translate-y-0 max-h-[500px]"
          leave-to-class="opacity-0 -translate-y-2 max-h-0"
        >
          <div v-show="showDescription" class="w-full overflow-hidden mt-4">
            <div 
              class="prose prose-sm prose-invert max-w-none bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 shadow-xl text-left"
              v-html="subTopic?.description"
            />
          </div>
        </Transition>
      </div>

      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-4 md:gap-2 relative mt-8 w-full max-w-5xl">
        <div 
          v-for="(lesson, index) in lessons" 
          :key="lesson.id" 
          class="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-2 w-full md:w-auto"
        >
          <div class="flex items-center gap-3 w-full md:w-auto">
            <div class="relative group shrink-0">
              <UButton 
                :disabled="!isLessonUnlocked(lesson, index)" 
                @click="goTo(lesson.id, isLessonUnlocked(lesson, index))" 
                :variant="!isLessonUnlocked(lesson, index) ? 'outline' : 'solid'" 
                :color="!isLessonUnlocked(lesson, index) ? 'primary' : 'neutral'" 
                :icon="isLessonUnlocked(lesson, index) ? 'i-lucide-unlock' : 'i-lucide-lock'" 
                :class="[
                  'transition-all duration-300',
                  isLessonUnlocked(lesson, index) 
                    ? 'cursor-pointer hover:scale-110 hover:shadow-lg' 
                    : 'cursor-not-allowed opacity-60 hover:animate-shake',
                  hasLearning(lesson.id) && 'ring-2 ring-green-500 shadow-lg shadow-green-500/30'
                ]"
              />
              
              <div 
                v-if="hasLearning(lesson.id)" 
                class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center animate-bounce-slow z-10"
              >
                <Icon name="i-lucide-check" class="w-2.5 h-2.5 text-white" />
              </div>
              
              <div 
                v-if="!isLessonUnlocked(lesson, index)"
                class="absolute -top-2 -right-2 pointer-events-none z-10"
              >
                <div class="relative">
                  <Icon name="i-lucide-lock" class="w-5 h-5 text-red-400 animate-pulse" />
                  <div class="absolute inset-0 bg-red-400/20 rounded-full blur-md animate-pulse"></div>
                </div>
              </div>
              
              <div class="hidden md:block absolute -top-14 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all duration-200 bg-gray-900/95 px-4 py-2 rounded-lg shadow-2xl border border-gray-700 whitespace-nowrap z-50 pointer-events-none">
                <p class="text-white text-[10px] md:text-xs font-semibold mb-1">{{ lesson.title }}</p>
                <p v-if="!isLessonUnlocked(lesson, index)" class="text-red-400 text-xs flex items-center gap-1">
                  <Icon name="i-lucide-lock" class="w-3 h-3" />
                  Selesaikan pelajaran sebelumnya
                </p>
                <p v-else-if="hasLearning(lesson.id)" class="text-green-400 text-xs flex items-center gap-1">
                  <Icon name="i-lucide-check-circle" class="w-3 h-3" />
                  Sudah diselesaikan
                </p>
                <p v-else class="text-blue-400 text-xs flex items-center gap-1">
                  <Icon name="i-lucide-play" class="w-3 h-3" />
                  Klik untuk memulai
                </p>
                <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900/95 rotate-45 border-r border-b border-gray-700"></div>
              </div>
            </div>

            <div class="md:hidden flex-1 bg-gray-900/90 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-gray-700 min-w-0">
              <p class="text-white text-sm font-semibold line-clamp-1 mb-1">{{ lesson.title }}</p>
              <p v-if="!isLessonUnlocked(lesson, index)" class="text-red-400 text-xs flex items-center gap-1.5">
                <Icon name="i-lucide-lock" class="w-3 h-3 shrink-0" />
                <span class="line-clamp-1">Selesaikan pelajaran sebelumnya</span>
              </p>
              <p v-else-if="hasLearning(lesson.id)" class="text-green-400 text-xs flex items-center gap-1.5">
                <Icon name="i-lucide-check-circle" class="w-3 h-3 shrink-0" />
                <span>Sudah diselesaikan</span>
              </p>
              <p v-else class="text-blue-400 text-xs flex items-center gap-1.5">
                <Icon name="i-lucide-play" class="w-3 h-3 shrink-0" />
                <span>Klik untuk memulai</span>
              </p>
            </div>
          </div>
          
          <div 
            v-if="index !== lessons.length - 1 && lessons[index + 1]" 
            :class="[
              'transition-all duration-500',
              'md:w-24 md:h-2 h-12 w-2 rounded-full',
              'mx-auto md:mx-0 shrink-0',
              (lessons[index + 1] && isLessonUnlocked(lessons[index + 1]!, index + 1))
                ? 'bg-gray-400 shadow-md shadow-gray-400/50' 
                : 'border-2 border-primary-800/80 bg-transparent'
            ]"
          />
        </div>
      </div>
    </div>

    <Sunset />
  </div>
</template>

<style scoped>
.stars {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle, #ffffff80 1px, transparent 1px) 0 0 / 80px 80px,
    radial-gradient(circle, #ffffff50 1px, transparent 1px) 40px 40px / 80px 80px;
  animation: twinkle 4s infinite ease-in-out;
  opacity: 0.6;
  z-index: 1;
}

.stars-layer-2 {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle, #ffffff60 0.5px, transparent 0.5px) 0 0 / 120px 120px,
    radial-gradient(circle, #ffffff30 0.5px, transparent 0.5px) 60px 60px / 120px 120px;
  animation: twinkle 6s infinite ease-in-out reverse;
  opacity: 0.4;
  z-index: 1;
}

.planet-container {
  position: absolute;
  width: 160px;
  height: 160px;
  z-index: 20;
}

.planet {
  position: relative;
  border-radius: 50%;
  box-shadow:
    inset -30px -30px 60px rgba(0, 0, 0, 0.5),
    0 0 40px var(--planet-color),
    0 0 80px var(--planet-color),
    0 0 120px var(--planet-color);
  filter: brightness(1.2);
  animation: pulse-glow 4s infinite ease-in-out;
}

.planet::before {
  content: '';
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--planet-color) 0%, transparent 70%);
  opacity: 0.3;
  animation: pulse-aura 3s infinite ease-in-out;
  z-index: -1;
}

.planet::after {
  content: '';
  position: absolute;
  inset: -40px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--planet-color) 0%, transparent 60%);
  opacity: 0.15;
  animation: pulse-aura 4s infinite ease-in-out reverse;
  z-index: -2;
}

/* Dark Planet - No Glow */
.planet-dark {
  box-shadow:
    inset -40px -40px 80px rgba(0, 0, 0, 0.9),
    inset 20px 20px 40px rgba(0, 0, 0, 0.7);
  filter: brightness(0.4);
  animation: none;
}

.planet-dark::before,
.planet-dark::after {
  display: none;
}

/* Orbital Elements Base */
.orbital-element {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -6px 0 0 -6px;
}

/* Style 1: Satellite */
.satellite {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 
    0 0 10px var(--element-color),
    0 0 20px var(--element-color),
    0 0 30px var(--element-color);
  animation: orbit 8s linear infinite;
}

.satellite::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--element-color), transparent);
  top: 50%;
  left: 100%;
  margin-top: -1px;
  border-radius: 2px;
  box-shadow: 0 0 5px var(--element-color);
}

/* Style 2: Ring */
.ring {
  width: 180px;
  height: 180px;
  margin: -90px 0 0 -90px;
  border: 3px solid var(--element-color);
  border-radius: 50%;
  opacity: 0.4;
  animation: ring-rotate 15s linear infinite;
  box-shadow: 
    0 0 20px var(--element-color),
    inset 0 0 20px var(--element-color);
}

.ring::before {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--element-color);
  border-radius: 50%;
  top: -4px;
  left: 50%;
  margin-left: -4px;
  box-shadow: 0 0 15px var(--element-color);
}

/* Style 3: Asteroid Belt */
.asteroid {
  width: 200px;
  height: 200px;
  margin: -100px 0 0 -100px;
  animation: orbit 20s linear infinite;
}

.asteroid::before,
.asteroid::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--element-color);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--element-color);
}

.asteroid::before {
  top: 0;
  left: 50%;
  animation: twinkle 2s infinite ease-in-out;
}

.asteroid::after {
  top: 50%;
  right: 0;
  animation: twinkle 2.5s infinite ease-in-out 0.5s;
}

/* Style 4: Moon */
.moon {
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, var(--element-color) 0%, transparent 50%);
  border-radius: 50%;
  box-shadow: 
    0 0 15px var(--element-color),
    inset -5px -5px 10px rgba(0, 0, 0, 0.5);
  animation: orbit-reverse 12s linear infinite;
  margin: -8px 0 0 -8px;
}

.moon::before {
  content: '';
  position: absolute;
  inset: 2px;
  background: radial-gradient(circle at 30% 30%, var(--element-color) 0%, transparent 60%);
  border-radius: 50%;
  opacity: 0.6;
}

/* Style 5: Comet */
.comet {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  box-shadow: 
    0 0 20px var(--element-color),
    0 0 40px var(--element-color);
  animation: comet-path 10s ease-in-out infinite;
  margin: -5px 0 0 -5px;
}

.comet::before {
  content: '';
  position: absolute;
  width: 80px;
  height: 3px;
  background: linear-gradient(90deg, var(--element-color), transparent);
  top: 50%;
  right: 100%;
  margin-top: -1.5px;
  border-radius: 3px;
  opacity: 0.7;
  box-shadow: 0 0 10px var(--element-color);
}

.comet::after {
  content: '';
  position: absolute;
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, var(--element-color), transparent);
  top: 50%;
  right: 100%;
  margin-top: 5px;
  border-radius: 2px;
  opacity: 0.4;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow:
      inset -30px -30px 60px rgba(0, 0, 0, 0.5),
      0 0 40px var(--planet-color),
      0 0 80px var(--planet-color),
      0 0 120px var(--planet-color);
    filter: brightness(1.2);
  }
  50% {
    box-shadow:
      inset -30px -30px 60px rgba(0, 0, 0, 0.5),
      0 0 60px var(--planet-color),
      0 0 120px var(--planet-color),
      0 0 160px var(--planet-color);
    filter: brightness(1.4);
  }
}

@keyframes pulse-aura {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

@keyframes orbit {
  0% {
    transform: rotate(0deg) translateX(100px) rotate(0deg);
  }
  100% {
    transform: rotate(360deg) translateX(100px) rotate(-360deg);
  }
}

@keyframes orbit-reverse {
  0% {
    transform: rotate(0deg) translateX(110px) rotate(0deg);
  }
  100% {
    transform: rotate(-360deg) translateX(110px) rotate(360deg);
  }
}

@keyframes ring-rotate {
  0% {
    transform: rotate(0deg) rotateX(75deg);
  }
  100% {
    transform: rotate(360deg) rotateX(75deg);
  }
}

@keyframes comet-path {
  0%, 100% {
    transform: rotate(45deg) translateX(120px) rotate(-45deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: rotate(405deg) translateX(120px) rotate(-405deg);
    opacity: 0;
  }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-2deg); }
  75% { transform: translateX(4px) rotate(2deg); }
}

.animate-bounce-slow {
  animation: bounce-slow 2s infinite;
}

.hover\:animate-shake:hover {
  animation: shake 0.5s ease-in-out;
}
</style>