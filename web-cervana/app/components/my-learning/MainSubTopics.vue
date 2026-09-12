<script setup lang="ts">
import type { BaseSubTopic } from '~/interfaces/curriculum/subTopics'

const props = defineProps<{
  title?: string
  subTopics: BaseSubTopic[]
}>()

type PositionKey = 'justify-start' | 'justify-center' | 'justify-end'

const positions: PositionKey[] = ['justify-start', 'justify-center', 'justify-end', 'justify-center']

const bubblePos: Record<PositionKey, string> = {
  'justify-start': 'left-[160px] top-1/2 -translate-y-1/2',
  'justify-center': 'top-[-80px] left-1/2 -translate-x-1/2',
  'justify-end': 'right-[160px] top-1/2 -translate-y-1/2'
}

const tailOrientation: Record<PositionKey, string> = {
  'justify-start': 'bubble-tail-left',
  'justify-center': 'bubble-tail-bottom',
  'justify-end': 'bubble-tail-right'
}




const openGate=(id:string)=>{
  navigateTo(`/my-learning/sub-topics/${id}`)
}


</script>

<template>
  <div class="py-20 space-y-28 md:space-y-32 relative">
    <div class="text-center relative z-10">
      <h1 class="text-2xl sm:text-4xl md:text-6xl xl:text-7xl font-orbitron font-bold drop-shadow-[0_0_25px_#4df]">
        Cervana Main Orbit 
      </h1>
      <p class="text-lg md:text-xl text-white/60 font-exo2 mt-2">
        {{ props.title || 'Journey Through The Universe' }}
      </p>
    </div>

    <div
      v-for="(value, index) in props.subTopics"
      :key="index"
      class="relative"
    >
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.6, y: 40, filter: 'blur(10px)' }"
        :enter="{
          opacity: 1,
          scale: 1,
          y: 0,
          filter: 'blur(0)',
          transition: { type: 'spring', stiffness: 260, damping: 18, delay: index * 0.2 }
        }"
        class="flex items-center relative w-full"
        :class="positions[index % positions.length]"
      >
        <div class="relative inline-block group">
          <div
            :style="{
              background: index % 3 === 0 
                ? `radial-gradient(circle at 30% 30%, ${value.theme?.secondary}${Math.min(50 + index * 8, 95)}, ${value.theme?.primary}${Math.min(40 + index * 8, 90)})` 
                : index % 3 === 1
                ? `linear-gradient(135deg, ${value.theme?.primary}${Math.min(40 + index * 8, 90)}, ${value.theme?.secondary}${Math.min(50 + index * 8, 95)})`
                : ['#5a3d5c', '#7b4b94', '#9b59b6', '#c39bd3', '#d7bde2', '#ebdef0'][Math.min(index, 5)],
              boxShadow: `0 0 ${15 + index * 2}px ${6 + index}px ${value.theme?.primary}${Math.min(30 + index * 5, 70)}, inset -15px -15px 30px ${value.theme?.primary}30, inset 15px 15px 30px ${value.theme?.secondary}20`
            }"
            @click="value.isUnlocked ? openGate(value.id) : null"
            :class="['size-28 md:size-32 rounded-full z-10 transition-all duration-500 relative overflow-hidden',value.isUnlocked?'planet-pulse  cursor-pointer hover:scale-110':'cursor-not-allowed opacity-70']"
          >

            <Icon
              v-if="!value.isUnlocked"
              name="lucide:lock-keyhole"
              class="lock-icon locked"
            />

            <div 
              :style="{ backgroundColor: `${value.theme?.secondary}20` }"
              class="absolute inset-0 rounded-full atmosphere-glow"
            />
            
            <div v-if="value.isUnlocked" class="absolute inset-0 surface-texture" />
            
            <div 
              :style="{ backgroundColor: `${value.theme?.primary}15` }"
              class="absolute w-8 h-16 rounded-full clouds-1"
            />
            <div 
              :style="{ backgroundColor: `${value.theme?.primary}10` }"
              class="absolute w-12 h-8 rounded-full clouds-2"
            />
          </div>

          <div
            v-if="index % 4 === 1"
            class="absolute top-1/2 left-1/2 pointer-events-none saturn-ring-container"
          >
            <div
              :style="{
                background: `linear-gradient(90deg, 
                  transparent 0%, 
                  ${value.theme?.primary}15 15%,
                  ${value.theme?.secondary}${Math.min(30 + index * 5, 60)} 35%,
                  ${value.theme?.primary}${Math.min(40 + index * 5, 70)} 50%,
                  ${value.theme?.secondary}${Math.min(30 + index * 5, 60)} 65%,
                  ${value.theme?.primary}15 85%,
                  transparent 100%)`,
                boxShadow: `0 0 20px ${value.theme?.primary}${Math.min(40 + index * 5, 70)}, 0 0 40px ${value.theme?.secondary}${Math.min(30 + index * 5, 60)}`
              }"
              class="w-56 h-3 md:w-64 md:h-4 rounded-full"
            />
            <div
              :style="{
                background: `linear-gradient(90deg, 
                  transparent 0%, 
                  ${value.theme?.secondary}${Math.min(20 + index * 5, 50)} 25%,
                  ${value.theme?.primary}${Math.min(30 + index * 5, 60)} 50%,
                  ${value.theme?.secondary}${Math.min(20 + index * 5, 50)} 75%,
                  transparent 100%)`
              }"
              class="w-48 h-2 md:w-56 md:h-3 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 saturn-ring-inner"
            />
          </div>

          <span
            v-for="n in 8"
            :key="n"
            :style="{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              backgroundColor: value.theme?.secondary,
              boxShadow: `0 0 ${Math.random() * 6 + 4}px ${value.theme?.secondary}`,
              top: '50%',
              left: '50%',
              animation: `orbit-${n % 5 + 1} ${Math.random() * 4 + 3}s linear infinite`
            }"
            class="absolute rounded-full star-sparkle"
          />

          <div
            :style="{
              borderColor: `${value.theme?.primary}20`,
              animation: 'orbit-ring 12s linear infinite'
            }"
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56 border-2 rounded-full opacity-30 pointer-events-none"
          />
        </div>
        
        <div
          :class="[
            'absolute text-white text-base md:text-lg max-w-[300px] px-5 py-3 rounded-xl z-20 backdrop-blur-xl shadow-lg bg-white/10 border border-white/20',
            bubblePos[positions[index % positions.length] as PositionKey],
            tailOrientation[positions[index % positions.length] as PositionKey]
          ]"
        >
          <div :class="['flex items-center space-x-2', !value.isUnlocked?'opacity-60':'']">
            <p class="font-semibold md:text-sm lg:text-base 2xl:text-xl text-[10px] sm:text-xs">{{ value.title }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble-tail-bottom::before {
  content: "";
  position: absolute;
  border-width: 12px 12px 0 12px;
  border-style: solid;
  border-color: transparent;
  border-top-color: rgba(255,255,255,0.3);
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.bubble-tail-left::before {
  content: "";
  position: absolute;
  border-width: 12px 12px 12px 0;
  border-style: solid;
  border-color: transparent;
  border-right-color: rgba(255,255,255,0.3);
  left: -15px;
  top: 50%;
  transform: translateY(-50%);
}

.bubble-tail-right::before {
  content: "";
  position: absolute;
  border-width: 12px 0 12px 12px;
  border-style: solid;
  border-color: transparent;
  border-left-color: rgba(255,255,255,0.3);
  right: -15px;
  top: 50%;
  transform: translateY(-50%);
}

@keyframes planet-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.planet-pulse {
  animation: planet-pulse 4s ease-in-out infinite;
}

.atmosphere-glow {
  animation: atmosphere-shimmer 6s ease-in-out infinite;
}

@keyframes atmosphere-shimmer {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

.surface-texture {
  background: linear-gradient(135deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%);
  background-size: 20px 20px;
  animation: texture-move 20s linear infinite;
}

@keyframes texture-move {
  0% { background-position: 0 0; }
  100% { background-position: 100px 100px; }
}

.clouds-1 {
  top: 20%;
  left: 15%;
  animation: cloud-drift-1 15s ease-in-out infinite;
  filter: blur(4px);
}


.lock-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 64px;
  height: 64px;
  transform: translate(-50%, -50%);
  z-index: 20;
}

.lock-icon.locked {
  color: #ef4444;
}

.clouds-2 {
  bottom: 25%;
  right: 10%;
  animation: cloud-drift-2 18s ease-in-out infinite;
  filter: blur(3px);
}

@keyframes cloud-drift-1 {
  0%, 100% { transform: translateX(0) translateY(0); }
  50% { transform: translateX(15px) translateY(-5px); }
}

@keyframes cloud-drift-2 {
  0%, 100% { transform: translateX(0) translateY(0); }
  50% { transform: translateX(-20px) translateY(8px); }
}

@keyframes orbit-1 { 
  0% { transform: rotate(0deg) translateX(50px) rotate(0deg); opacity: 1; }
  50% { opacity: 0.6; }
  100% { transform: rotate(360deg) translateX(50px) rotate(-360deg); opacity: 1; }
}
@keyframes orbit-2 { 
  0% { transform: rotate(72deg) translateX(55px) rotate(-72deg); opacity: 0.8; }
  50% { opacity: 1; }
  100% { transform: rotate(432deg) translateX(55px) rotate(-432deg); opacity: 0.8; }
}
@keyframes orbit-3 { 
  0% { transform: rotate(144deg) translateX(45px) rotate(-144deg); opacity: 0.9; }
  50% { opacity: 0.5; }
  100% { transform: rotate(504deg) translateX(45px) rotate(-504deg); opacity: 0.9; }
}
@keyframes orbit-4 { 
  0% { transform: rotate(216deg) translateX(52px) rotate(-216deg); opacity: 0.7; }
  50% { opacity: 1; }
  100% { transform: rotate(576deg) translateX(52px) rotate(-576deg); opacity: 0.7; }
}
@keyframes orbit-5 { 
  0% { transform: rotate(288deg) translateX(48px) rotate(-288deg); opacity: 1; }
  50% { opacity: 0.8; }
  100% { transform: rotate(648deg) translateX(48px) rotate(-648deg); opacity: 1; }
}

@keyframes orbit-ring {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.saturn-ring-container {
  transform: translate(-50%, -50%) rotateX(75deg);
  transform-style: preserve-3d;
  perspective: 1000px;
}

.saturn-ring-outer {
  animation: saturn-rotate 12s linear infinite;
  opacity: 0.8;
}

.saturn-ring-inner {
  animation: saturn-rotate 10s linear infinite reverse;
  opacity: 0.6;
}

@keyframes saturn-rotate {
  0% { transform: translate(-50%, -50%) rotateZ(0deg); }
  100% { transform: translate(-50%, -50%) rotateZ(360deg); }
}
</style>