<template>
  <div class="w-full mx-auto relative overflow-hidden">
    <UiDownStarAnimation :length="100" />
    <div class="w-full max-w-7xl mx-auto">
      <HeroSection />
      <CarrouselHome />
      <FeatureSection />
    </div>
    <Glassy />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'CERVANA – AI Gamified Learning for SMK Certification',
  meta: [
    {
      name: 'description',
      content: 'CERVANA adalah platform pembelajaran berbasis AI Agent Learning dan Retrieval-Augmented Generation (RAG) dengan gamifikasi untuk membantu siswa SMK Akuntansi mempersiapkan sertifikasi kompetensi.'
    },

    { property: 'og:title', content: 'CERVANA – Inovasi Pembelajaran AI Gamifikasi' },
    {
      property: 'og:description',
      content: 'Tingkatkan kesiapan sertifikasi SMK Akuntansi dengan AI Agent Learning, RAG, dan gamifikasi interaktif.'
    },
    { property: 'og:image', content: '/images/seo/cervana-preview.png' },
    { property: 'og:type', content: 'website' },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'CERVANA – AI Gamified Learning' },
    {
      name: 'twitter:description',
      content: 'Belajar interaktif untuk sertifikasi SMK Akuntansi dengan AI & gamifikasi.'
    },
    { name: 'twitter:image', content: '/images/seo/cervana-preview.png' }
  ],

  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },

    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' },

    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },

    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap"
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,100..900;1,100..900&display=swap"
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Orbitron:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap"
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap"
    }
  ]
});
import CarrouselHome from '~/components/landingpage/CarrouselHome.vue';
import FeatureSection from '~/components/landingpage/FeatureSection.vue';
import HeroSection from '~/components/landingpage/HeroSection.vue';
import Glassy from '~/components/ui/Glassy.vue';
</script>
