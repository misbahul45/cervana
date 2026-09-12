<template>
  <section
    class="w-full min-h-screen flex flex-col overflow-hidden items-center justify-center relative px-4 sm:px-6 md:px-8"
  >
    <div class="universe-bg absolute inset-0 -z-10"></div>
    <div
      class="w-full relative pb-8 pt-28 sm:pt-24 md:pt-20 lg:pt-16 max-w-md sm:max-w-lg md:max-w-xl mx-auto flex flex-col items-center justify-center"
    >
      <div class="z-10 w-full text-center">
        <h1
          class="font-exo2 mb-2 font-bold text-transparent bg-clip-text bg-linear-to-r from-primary/80 to-primary/60 tracking-wide text-3xl sm:text-4xl md:text-5xl xl:text-6xl"
        >
          CERVANA
        </h1>
        <p
          class="text-xs md:text-sm max-w-md mx-auto mb-8"
        >
          Selamat datang kembali! Ayo lanjutkan perjalanan belajarmu bersama Cervana.
        </p>
        <FormLogin />
        <p
          class="text-xs sm:text-sm md:text-base mt-6"
        >
          Belum punya akun?
          <RouterLink
            to="/register"
            class="text-primary/80 hover:text-primary/60 font-medium transition-colors duration-200 hover:underline"
          >
            Daftar Sekarang
          </RouterLink>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import FormLogin from "~/components/auth/FormLogin.vue";
useHead({
  title: 'Sign In | Cervana',
  meta: [
    {
      name: 'description',
      content:
        'Log in to your Cervana account and continue your journey through the cosmic realm of AI learning.',
    },
    { name: 'keywords', content: 'Cervana, login, sign in, AI learning, cosmic' },
    { property: 'og:title', content: 'Sign In | Cervana' },
    { property: 'og:description', content: 'Access your Cervana account and keep exploring the universe of knowledge.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://cervana.ai/login' },
    { property: 'og:image', content: '/meta/og-login.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Sign In | Cervana' },
    { name: 'twitter:description', content: 'Access your Cervana account and keep exploring the universe of knowledge.' },
    { name: 'twitter:image', content: '/meta/og-login.png' },
  ],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
})

</script>

