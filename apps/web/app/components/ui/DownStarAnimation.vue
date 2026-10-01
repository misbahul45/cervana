<template>
  <div class="absolute inset-0 overflow-hidden -z-10">
    <div
      v-for="(star, idx) in stars"
      :key="idx"
      class="absolute bg-linear-to-b from-white via-secondary/80 to-transparent opacity-90 rounded-full shooting-star"
      :style="{
        top: star.top,
        left: star.left,
        width: star.width,
        height: star.height,
        animationDelay: star.delay,
        animationDuration: star.duration
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
const { length = 50 } = defineProps<{ length?: number }>()
const stars = ref<
  { top: string; left: string; width: string; height: string; delay: string; duration: string }[]
>([])

onMounted(() => {
  stars.value = Array.from({ length }).map(() => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    width: `${0.05 + Math.random() * 0.15}vw`, 
    height: `${1 + Math.random() * 2}vh`,     
    delay: `${Math.random() * 8}s`,
    duration: `${3 + Math.random() * 4}s`
  }))
})
</script>

<style scoped>
.shooting-star {
  animation: shoot linear infinite;
  filter: drop-shadow(0 0 4px white);
}

@keyframes shoot {
  0% {
    transform: translateX(0) translateY(0) rotate(45deg) scale(0.8);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateX(15vw) translateY(-15vh) rotate(45deg) scale(1.1);
    opacity: 0;
  }
}
</style>
