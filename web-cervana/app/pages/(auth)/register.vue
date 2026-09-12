<template>
  <section
    class="px-4 sm:px-6 md:px-8 w-full pb-12 pt-28 sm:pt-24 md:pt-20 lg:pt-16 relative min-h-screen overflow-hidden flex items-center justify-center"
  >
    <div class="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto relative z-10">
      <h1
        class="font-exo2 text-center mb-2 title font-bold text-transparent bg-clip-text bg-linear-to-r from-primary/80 to-primary/90 tracking-wide text-4xl sm:text-5xl md:text-6xl"
      >
        CERVANA
      </h1>

      <p
        class="mb-6 text-center max-w-lg mx-auto text-xs md:text-sm opacity-80 leading-relaxed px-2"
      >
        🚀 {{ registerDesc }}
      </p>

      <FormRegister />

      <p
        class="font-medium font-robotomono mt-8 text-center text-sm sm:text-base"
      >
        Sudah punya akun?
        <RouterLink
          to="/login"
          class="text-primary/80 hover:underline hover:text-primary/60 transition-colors duration-200"
        >
          Kembali Kesatria
        </RouterLink>
      </p>
    </div>

    <DownStarAnimation />
  </section>
</template>

<script setup lang="ts">
import FormRegister from "~/components/auth/FormRegister.vue";
import DownStarAnimation from "~/components/ui/DownStarAnimation.vue";
useHead({
  title: 'Join the Cosmic Journey | Cervana',
  meta: [
    {
      name: 'description',
      content:
        'Create your Cervana account and begin your cosmic learning adventure powered by AI and curiosity.',
    },
    { name: 'keywords', content: 'Cervana, register, sign up, AI learning, cosmic' },
    { property: 'og:title', content: 'Join the Cosmic Journey | Cervana' },
    { property: 'og:description', content: 'Start your Cervana journey and explore the infinite universe of learning.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://cervana.ai/register' },
    { property: 'og:image', content: '/meta/og-register.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Join the Cosmic Journey | Cervana' },
    { name: 'twitter:description', content: 'Start your Cervana journey and explore the infinite universe of learning.' },
    { name: 'twitter:image', content: '/meta/og-register.png' },
  ],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
})


const registerDesc =
"Siap memulai perjalananmu? Buat akun sekarang dan tingkatkan kemampuanmu dengan notebook pembelajaran bertenaga AI dari Cervana!"

</script>
