<template>
  <div
    class="relative w-full min-h-screen overflow-hidden flex flex-col items-center justify-center text-center px-4"
    :style="{ background: 'var(--rc-bg)', color: 'var(--rc-fg)' }"
  >
    <div class="relative z-10 max-w-2xl space-y-8">
      <h1
        class="text-8xl md:text-9xl font-bold"
        :style="{ color: 'var(--rc-primary)' }"
      >
        404
      </h1>

      <div class="space-y-3">
        <p class="text-2xl md:text-4xl font-bold">Halaman tidak ditemukan</p>
        <p class="text-lg md:text-xl" :style="{ color: 'var(--rc-muted)' }">
          Tautan ini sudah tidak berlaku atau halaman sudah dipindahkan.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
        <UButton
          icon="i-lucide-home"
          size="lg"
          color="primary"
          to="/"
        >
          Kembali ke Beranda
        </UButton>
        <UButton
          icon="i-lucide-arrow-left"
          variant="outline"
          size="lg"
          @click="goBack"
        >
          Halaman Sebelumnya
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goBack = () => {
  router.back();
};

useHead({
  title: 'Halaman tidak ditemukan – ReduCera',
});
</script>
