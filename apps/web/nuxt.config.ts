import tailwindcss from "@tailwindcss/vite";
import { defineNuxtConfig } from 'nuxt/config'

function stripPrefix(url: string | undefined, prefix: string): string | undefined {
  if (!url) return url;
  return url.endsWith(prefix) ? url.slice(0, -prefix.length) : url;
}

export default defineNuxtConfig({
  ssr: true,
  experimental: {
    asyncContext: true,
  },
  app: {
    head: {
      title: 'ReduCera: Ekosistem Belajar Dinamis yang Menyesuaikan Diri denganmu',
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'description', content: 'ReduCera memilih topik belajar berikutnya dari penguasaan dan miskonsepsimu. Mulai dari akuntansi dengan 65 konsep berprasyarat, latihan jurnal, simulator, dan jalur menjadi kreator.' },
        { property: 'og:title', content: 'ReduCera: Ekosistem Belajar Dinamis' },
        { property: 'og:description', content: 'Jalur belajarmu berubah karena kamu berubah. Topik berikutnya dipilih dari penguasaan dan miskonsepsimu.' },
        { property: 'og:image', content: '/images/seo/reducera-preview.png' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'ReduCera: Ekosistem Belajar Dinamis' },
        { name: 'twitter:description', content: 'Jalur belajarmu berubah karena kamu berubah. Topik berikutnya dipilih dari penguasaan dan miskonsepsimu.' },
        { name: 'twitter:image', content: '/images/seo/reducera-preview.png' },
        { name: 'theme-color', content: '#F2FAFB', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#04202D', media: '(prefers-color-scheme: dark)' },
        { name: 'keywords', content: 'ReduCera, pembelajaran adaptif, microlearning, belajar akuntansi, jurnal umum, simulator bisnis, gamifikasi, kreator pengetahuan' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preload', as: 'font', href: '/fonts/nunito/Nunito-Variable.woff2', type: 'font/woff2', crossorigin: 'anonymous' },
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
    '@tresjs/nuxt',
  ],
  components: {
    dirs: [
      { path: '~/components/play', pathPrefix: false },
      { path: '~/components/landing', pathPrefix: false },
      '~/components',
    ]
  },
  hooks: {
    'components:extend': (components) => {
      const aliased = new Map<string, string>([
        ['ErrorState', '/components/ui/'],
        ['EmptyState', '/components/ui/'],
        ['LoadingSkeleton', '/components/ui/'],
        ['StatusBadge', '/components/ui/'],
        ['ConfirmDialog', '/components/ui/'],
        ['InsufficientCreditsState', '/components/ui/'],
        ['ForbiddenState', '/components/ui/'],
        ['RetryAction', '/components/ui/'],
        ['PreviewNotice', '/components/ui/'],
        ['TenantSwitcher', '/components/ui/'],
        ['Glassy', '/components/ui/'],
        ['Toast', '/components/ui/'],
        ['ProductCard', '/components/marketplace/'],
        ['BadgeGrid', '/components/gamification/'],
        ['LevelBadge', '/components/gamification/'],
        ['SkillTreeLeaf', '/components/gamification/'],
        ['CitationList', '/components/ai/'],
        ['CreditCostConfirm', '/components/ai/'],
        ['TutorMessage', '/components/ai/'],
        ['TutorStatus', '/components/ai/'],
        ['StatementPanel', '/components/simulator/'],
        ['TopicNode', '/components/skill-tree/'],
        ['MasteryMeter', '/components/learn/'],
        ['NextActivityCard', '/components/learn/'],
        ['StreakIndicator', '/components/learn/'],
        ['DebitCreditTotal', '/components/sandbox/'],
        ['JournalEntryGrid', '/components/sandbox/'],
        ['SkipLink', '/components/layout/'],
      ]);
      const taken = new Set(components.map((component) => component.pascalName));
      for (const component of [...components]) {
        const path = component.filePath.replaceAll('\\', '/');
        const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.vue$/, '');
        const folder = aliased.get(base);
        if (!folder || !path.includes(folder) || taken.has(base)) continue;
        taken.add(base);
        const kebab = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        components.push({ ...component, pascalName: base, kebabName: kebab });
      }
    },
  },
  pinia:{
    storesDirs: []
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storage: 'cookie',
    storageKey: 'rc-color-mode',
    classSuffix: '',
  },
  ui:{
    colorMode:true,
  },
  icon: {
      serverBundle: {
        collections: ['lucide', 'heroicons'],
      },
      clientBundle: {
        scan: true,
      },
      localApiEndpoint: '/_rc/icons',
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
  css: ['~/assets/css/main.css', '~/assets/css/play.css', '~/assets/css/landing.css', '~/assets/css/admin.css', '~/assets/css/market.css', '~/assets/css/article.css'],
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
    apiInternalUrl: stripPrefix(process.env.API_URL_INTERNAL, '/api/v1') || 'http://api:3002',
    aiInternalUrl: stripPrefix(process.env.AI_API_INTERNAL_URL, '/ai/v1') || 'http://ai-api:3003',
    public: {
      API_URL: stripPrefix(process.env.NUXT_PUBLIC_API_URL, '/api/v1') || 'http://localhost',
      AI_URL: stripPrefix(process.env.NUXT_PUBLIC_AI_URL, '/ai/v1') || 'http://localhost',
      SITE_URL: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost',
    }
  },
  image: {
    inject: true,
  },
});
