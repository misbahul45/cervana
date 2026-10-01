<script setup lang="ts">
import { useState } from '#imports'

const props = defineProps<{
  topicId: string
}>()


const router = useRouter()
const route = useRoute()

const showHeader = computed(() => {
  return !route.path.includes('/my-learning/steps')
})

const goBack = () => {
  router.back()
}
</script>

<template>
  <div v-if="showHeader" class="universe-header absolute top-0 left-0 h-16 flex justify-between items-center w-full z-50 px-[10%]">
    <div class="flex items-center gap-4">
      <UButton
        variant="outline"
        color="secondary"
        class="cosmic-btn group cursor-pointer"
        @click="goBack"
      >
        <UIcon name="i-lucide-move-left" class="cosmic-icon w-6 h-6" style="stroke-width:2" />
      </UButton>
      <NuxtLink to="/learn/topics">
        <UButton
          variant="outline"
          color="secondary"
          class="cosmic-btn group cursor-pointer"
        >
          <UIcon name="i-lucide-telescope" class="cosmic-icon w-6 h-6" style="stroke-width:2" />
        </UButton>
      </NuxtLink>
    </div>

    <div class="flex items-center gap-4">
      <UButton variant="outline" color="secondary" class="cosmic-btn group cursor-pointer">
        <UIcon name="i-lucide-gem" class="cosmic-icon w-6 h-6" style="stroke-width:2" />
      </UButton>

      <UButton variant="outline" color="secondary" class="cosmic-btn group cursor-pointer">
        <UIcon name="i-lucide-zap" class="cosmic-icon w-6 h-6" style="stroke-width:2" />
      </UButton>

      <UButton variant="outline" color="secondary" class="cosmic-btn group cursor-pointer">
        <UIcon name="i-lucide-trending-up" class="cosmic-icon w-6 h-6" style="stroke-width:2" />
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.universe-header {
  background: transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.universe-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(99, 102, 241, 0.4) 20%,
    rgba(139, 92, 246, 0.6) 50%,
    rgba(99, 102, 241, 0.4) 80%,
    transparent 100%
  );
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.cosmic-btn {
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  background: rgba(30, 41, 59, 0.4);
}

.cosmic-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent 70%);
  transform: translate(-50%, -50%);
  transition: width 0.6s ease, height 0.6s ease;
}

.cosmic-btn:hover::before {
  width: 200px;
  height: 200px;
}

.cosmic-btn:hover {
  border-color: rgba(139, 92, 246, 0.6);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(99, 102, 241, 0.2);
  transform: translateY(-2px);
}

.cosmic-icon {
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
  filter: drop-shadow(0 0 2px rgba(139, 92, 246, 0.5));
}

.cosmic-btn:hover .cosmic-icon {
  filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.8));
  transform: scale(1.1) rotate(5deg);
}

.cosmic-btn:active {
  transform: translateY(0);
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
}

.cosmic-btn {
  animation: float 3s ease-in-out infinite;
}

.cosmic-btn:nth-child(1) { animation-delay: 0s; }
.cosmic-btn:nth-child(2) { animation-delay: 0.2s; }
.cosmic-btn:nth-child(3) { animation-delay: 0.4s; }
.cosmic-btn:nth-child(4) { animation-delay: 0.6s; }
.cosmic-btn:nth-child(5) { animation-delay: 0.8s; }
</style>