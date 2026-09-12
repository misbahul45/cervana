<script setup lang="ts">
const props = defineProps<{
  text: string
}>();

const activeSvg = ref<1 | 2>(1);

onMounted(() => {
  setInterval(() => {
    activeSvg.value = activeSvg.value === 1 ? 2 : 1;
  }, 5000);
});
</script>

<template>
  <div class="flex gap-1 items-center">
    
    <div class="relative w-8 h-8">

      <!-- SVG 1 -->
      <div
        v-show="activeSvg === 1"
        class="absolute inset-0 transition-opacity duration-300"
        :class="activeSvg === 1 ? 'opacity-100' : 'opacity-0'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle fill="#FF7810" stroke="#FF7810" stroke-width="15" r="15" cx="40" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.4"></animate></circle><circle fill="#FF7810" stroke="#FF7810" stroke-width="15" r="15" cx="100" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.2"></animate></circle><circle fill="#FF7810" stroke="#FF7810" stroke-width="15" r="15" cx="160" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="0"></animate></circle></svg>
      </div>

      <!-- SVG 2 -->
      <div
        v-show="activeSvg === 2"
        class="absolute inset-0 transition-opacity duration-300"
        :class="activeSvg === 2 ? 'opacity-100' : 'opacity-0'"
      >
        <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150">
          <path fill="none" stroke="#FF6A25" stroke-width="15" stroke-linecap="round"
            stroke-dasharray="300 385" stroke-dashoffset="0"
            d="M275 75c0 31-27 50-50 50-58 0-92-100-150-100-28 0-50 22-50 50s23 50 50 50c58 0 92-100 150-100 24 0 50 19 50 50Z">
            <animate attributeName="stroke-dashoffset" dur="2"
              values="685;-685" repeatCount="indefinite" />
          </path>
        </svg>
      </div>

    </div>

    <p class="max-w-full text-xs animate-pulse line-clamp-2">{{ props.text }}</p>
  </div>
</template>
