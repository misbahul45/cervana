<template>
  <div class="w-full mx-auto relative overflow-hidden">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--rc-primary)] focus:px-4 focus:py-2 focus:text-[var(--rc-primary-fg)]"
    >
      Lewati ke konten
    </a>
    <main id="main" class="w-full max-w-7xl mx-auto">
      <h1 class="sr-only">ReduCera – Ekosistem Belajar Akuntansi</h1>
      <HeroSection />
      <CarrouselHome />
      <FeatureSection />
    </main>
    <Glassy />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'ReduCera – Ekosistem Belajar Akuntansi Berbasis AI untuk mahasiswa',
});
</script>
