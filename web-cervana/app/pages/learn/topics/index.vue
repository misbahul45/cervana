<script setup lang="ts">
import BannerTopics from '~/components/topics/BannerTopics.vue';
import MappingCategories from '~/components/topics/MappingCategories.vue';
import MappingTopics from '~/components/topics/MappingTopics.vue';

useHead({
  title: 'CERVANA Topics | Sertifikasi Akuntansi SMK Berbasis AI & Gamifikasi',
  meta: [
    {
      name: 'description',
      content:
        'Jelajahi topik pembelajaran CERVANA — modul microlearning berbasis AI dan gamifikasi yang dirancang untuk membantu siswa SMK Akuntansi mempersiapkan sertifikasi kompetensi BNSP dan SKKNI.',
    },
    {
      name: 'keywords',
      content:
        'CERVANA, sertifikasi akuntansi, SMK akuntansi, microlearning, AI learning, gamifikasi, BNSP, SKKNI, RAG, pembelajaran adaptif',
    },
    { property: 'og:title', content: 'CERVANA Topics | Sertifikasi Akuntansi SMK Berbasis AI & Gamifikasi' },
    {
      property: 'og:description',
      content:
        'Temukan materi pembelajaran CERVANA yang membantu siswa SMK Akuntansi mempersiapkan sertifikasi kompetensi dengan pendekatan microlearning dan AI Agent Learning.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://cervana.ai/app/topics' },
    { property: 'og:image', content: '/meta/og-topics.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'CERVANA Topics | Sertifikasi Akuntansi SMK Berbasis AI & Gamifikasi' },
    {
      name: 'twitter:description',
      content:
        'Pelajari topik CERVANA — konten microlearning berbasis AI untuk persiapan sertifikasi kompetensi SMK Akuntansi.',
    },
    { name: 'twitter:image', content: '/meta/og-topics.png' },
  ],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
})

</script>

<template>
<div class="relative space-y-10 md:space-y-8 pb-10 overflow-hidden">
  <BannerTopics />
  <MappingCategories />
  <MappingTopics />
</div>
</template>