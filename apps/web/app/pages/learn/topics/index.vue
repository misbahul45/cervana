<script setup lang="ts">
import BannerTopics from '~/components/topics/BannerTopics.vue';
import MappingCategories from '~/components/topics/MappingCategories.vue';
import MappingTopics from '~/components/topics/MappingTopics.vue';

const siteUrl = useRuntimeConfig().public.SITE_URL

useHead({
  title: 'Topik Akuntansi | ReduCera',
  meta: [
    {
      name: 'description',
      content:
        'Jelajahi topik pembelajaran ReduCera — modul microlearning berbasis AI dan gamifikasi yang dirancang untuk membantu mahasiswa Akuntansi mempersiapkan penguasaan kompetensi akuntansi terstruktur.',
    },
    {
      name: 'keywords',
      content:
        'ReduCera, penguasaan akuntansi, akuntansi perguruan tinggi, microlearning, AI learning, gamifikasi, akuntansi, akuntansi, RAG, pembelajaran adaptif',
    },
    { property: 'og:title', content: 'Topik Akuntansi | ReduCera' },
    {
      property: 'og:description',
      content:
        'Temukan materi pembelajaran ReduCera yang membantu mahasiswa Akuntansi mempersiapkan penguasaan kompetensi dengan pendekatan microlearning dan AI Agent Learning.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: `${siteUrl}/learn/topics` },
    { property: 'og:image', content: '/meta/og-topics.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Topik Akuntansi | ReduCera' },
    {
      name: 'twitter:description',
      content:
        'Pelajari topik ReduCera — konten microlearning berbasis AI untuk persiapan penguasaan kompetensi akuntansi perguruan tinggi.',
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