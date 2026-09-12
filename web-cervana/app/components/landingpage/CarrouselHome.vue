<script setup lang="ts">
import { ref } from 'vue';
const isHovered = ref(false);

const keywords = [
  "Pembelajaran Adaptif",
  "Sertifikat Digital",
  "Progress Tracking",
  "AI Cerdas",
  "Gamifikasi Seru",
  "Belajar Interaktif",
  "RAG Integration",
  "Analisis Otomatis",
  "Rekomendasi Materi",
  "Umpan Balik Langsung",
  "Evaluasi Real-Time",
  "Mode Tantangan",
  "Poin & Level",
  "Leaderboard Dinamis",
  "Profil Kompetensi",
  "Kustomisasi Belajar",
  "Pembelajaran Mandiri",
  "Akses Fleksibel",
  "Cloud-Based",
  "Cepat & Efisien",
  "Antarmuka Modern",
  "AI Mentor",
  "Sertifikasi Kompeten",
  "Siap Dunia Kerja",
  "Materi Terpersonalisasi",
  "Adaptive Assessment",
  "Insight Pembelajaran",
  "Motivasi Belajar",
  "Kecerdasan Adaptif",
  "Pengalaman Imersif",
  "Skill Tracking",
  "Peningkatan Kompetensi",
  "Rekomendasi AI",
  "Belajar Kapan Saja",
  "Kelas Interaktif",
  "Simulasi Industri",
  "Belajar Otodidak",
  "Integrasi Cloud",
  "AI Gamified System",
  "Pembelajaran Efektif",
  "Visualisasi Progres",
  "Smart Dashboard",
  "Sertifikat Resmi",
  "Mudah & Menyenangkan"
]
</script>

<template>
    <div
      class="mx-auto w-full inline-flex flex-nowrap overflow-hidden my-10
             [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-200px),transparent_100%)]"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <ul
        class="flex items-center [&_li]:mx-4 animate-infinite-scroll"
        :class="{ 'animation-paused': isHovered }"
      >
        <li v-for="(word, index) in keywords" :key="index">
          <span
            class="inline-block px-4 py-1 text-nowrap text-sm font-semibold rounded-full shadow-md
                   transition-transform duration-300 transform
                   opacity-60 hover:opacity-100 hover:scale-110
                   bg-linear-to-r from-primary to-secondary text-white"
          >
            {{ word }}
          </span>
        </li>
      </ul>

      <ul
        aria-hidden="true"
        class="flex items-center [&_li]:mx-4 animate-infinite-scroll"
        :class="{ 'animation-paused': isHovered }"
      >
        <li v-for="(word, index) in keywords" :key="`clone-${index}`">
          <span
            class="inline-block px-4 py-1 text-nowrap text-sm font-semibold rounded-full shadow-md
                   transition-transform duration-300 transform
                   opacity-60 hover:opacity-100 hover:scale-110
                   bg-linear-to-r from-primary to-secondary text-white"
          >
            {{ word }}
          </span>
        </li>
      </ul>
    </div>
</template>

<style>
@keyframes infinite-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

.animate-infinite-scroll {
  animation: infinite-scroll 60s linear infinite;
}

.animation-paused {
  animation-play-state: paused;
}
</style>
