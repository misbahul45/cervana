import tailwindcss from "@tailwindcss/vite";
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  app: {
    head: {
      title: 'CERVANA – AI Gamified Learning for SMK Certification',
      meta: [
        { name: 'description', content: 'CERVANA adalah platform pembelajaran berbasis AI Agent Learning dan Retrieval-Augmented Generation (RAG) dengan gamifikasi untuk membantu siswa SMK Akuntansi mempersiapkan sertifikasi kompetensi.' },
        { property: 'og:title', content: 'CERVANA – Inovasi Pembelajaran AI Gamifikasi' },
        { property: 'og:description', content: 'Tingkatkan kesiapan sertifikasi SMK Akuntansi dengan AI Agent Learning, RAG, dan gamifikasi interaktif.' },
        { property: 'og:image', content: '/images/seo/cervana-preview.png' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'CERVANA – AI Gamified Learning' },
        { name: 'twitter:description', content: 'Belajar interaktif untuk sertifikasi SMK Akuntansi dengan AI & gamifikasi.' },
        { name: 'twitter:image', content: '/images/seo/cervana-preview.png' },
      ],
      link: [
        // Favicon utama (ICO)
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },

        // Favicon PNG tambahan
        { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png' },

        // SVG (untuk Chrome modern)
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },

        // Apple icon
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },

        // Manifest file
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    }
  },
  compatibilityDate: '2025-07-15',

  modules: [
    '@nuxt/ui',
    '@nuxt/image',
    '@vueuse/motion/nuxt',
    '@peterbud/nuxt-query',
    '@nuxt/icon',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
  ],
  components: {
    dirs: [
      '~/components',
    ]
  },
  pinia:{
    storesDirs: []
  },
  ui:{
    colorMode:true,
  },
  icon: {
      collections: ['lucide', 'ph', 'mdi'],
      serverBundle: {
        externalizeIconsJson: true,
      },
      provider: 'iconify',
  },
  nuxtQuery: {
    autoImports: ['useQuery', 'useMutation'],
    queryClientOptions: {
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: 1,
          staleTime: 1000 * 60 * 5
        }
      }
    }
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        "@iconify-json/lucide/icons.json",
        "@iconify-json/mdi/icons.json",
        "@iconify-json/ph/icons.json",
        "@iconify-json/tabler/icons.json"
      ]
    }
  },
  runtimeConfig: {
    apiUrl: process.env.API_URL,
    aiurl: process.env.AI_URL,
    public: {
      API_URL: process.env.NUXT_PUBLIC_API_URL || "http://localhost:3002/api/v1",
      AI_URL:process.env.NUXT_PUBLIC_AI_URL || "http://localhost:3003/ai/v1"
    }
  },
  image: {
    inject: true,
  },
});
