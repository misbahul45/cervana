<template>
  <section class="relative flex flex-col justify-center items-center w-full min-h-screen overflow-hidden px-4 py-16 sm:py-20 text-center">
    <div class="z-10 flex flex-col md:flex-row items-center gap-10 md:gap-12 lg:gap-16 w-full">
      <div class="flex-1 flex flex-col items-center gap-6 text-center md:text-left order-2 md:order-1">
        <h1 class="text-3xl sm:text-4xl lg:text-5xl text-center xl:text-6xl font-bold" :style="{ color: 'var(--rc-fg)' }">
          ReduCera
          <span class="block text-xl sm:text-2xl lg:text-3xl xl:text-4xl mt-2" :style="{ color: 'var(--rc-primary)' }">
            Ekosistem Belajar Akuntansi
          </span>
        </h1>

        <p class="text-center text-sm md:text-base lg:text-lg max-w-xl" :style="{ color: 'var(--rc-muted)' }">
          Kuasai akuntansi dari persamaan dasar sampai laporan keuangan bersama tutor AI yang mengenal cara belajarmu. Setiap konsep punya suasana belajarnya sendiri, dari perairan dangkal sampai laut dalam.
        </p>

        <div class="flex flex-wrap gap-3 justify-center md:justify-start">
          <NuxtLink to="/login">
            <UButton icon="i-lucide-graduation-cap" variant="solid" size="lg" color="primary"
              class="transition-all duration-300 transform hover:-translate-y-1">
              Mulai Belajar
            </UButton>
          </NuxtLink>
          <UButton icon="i-lucide-pencil-line" variant="outline" size="lg" color="primary"
            class="transition-all duration-300 transform hover:-translate-y-1">
            Jadi Kreator
          </UButton>
        </div>
      </div>

      <div class="flex-1 relative flex items-center justify-center order-1 md:order-2">
        <div class="relative w-full max-w-sm lg:max-w-md 2xl:max-w-xl">
          <OceanHero class="w-full h-auto relative z-10" />
          <div
            v-for="(item, i) in keywords"
            :key="i"
            v-motion
            :initial="{ y: 0, scale: 1, opacity: 1 }"
            :animate="{ y: [0, -8, 0], scale: [1, 1.05, 1], opacity: [1, 1, 1] }"
            :transition="{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }"
            class="absolute px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-primary/10 border border-primary/30 backdrop-blur-md shadow-lg text-xs sm:text-sm md:text-base text-foreground font-semibold whitespace-nowrap hover:scale-110 hover:bg-primary/20 transition-all duration-500"
            :class="positions[i]"
          >
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>{{ item }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import OceanHero from '~/components/landingpage/OceanHero.vue'

const keywords = ['Otomasi', 'Gamified', 'Adaptif', 'Penguasaan']

const positions = [
  'top-4 left-0 sm:top-8 sm:left-4',
  'top-4 right-0 sm:top-8 sm:right-4',
  'bottom-4 left-0 sm:bottom-8 sm:left-4',
  'bottom-4 right-0 sm:bottom-8 sm:right-4'
]
</script>
