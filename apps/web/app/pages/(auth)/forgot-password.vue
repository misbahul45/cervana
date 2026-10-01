<template>
  <section class="w-full min-h-screen overflow-hidden relative flex flex-col items-center justify-center px-4">
    <div class="universe-bg absolute inset-0 -z-10"></div>

    <ForgotPasswordForm v-if="!successReset" @success="successReset = true" />
    <ResetPasswordForm v-else />

    <DownStarAnimation />
  </section>
</template>

<script setup lang="ts">
const siteUrl = useRuntimeConfig().public.SITE_URL

useHead({
  title: 'Forgot Password | ReduCera',
  meta: [
    {
      name: 'description',
      content:
        'Reset your ReduCera account password securely. Reconnect to the cosmic learning universe.',
    },
    { name: 'keywords', content: 'ReduCera, forgot password, reset, AI learning, cosmic' },
    { property: 'og:title', content: 'Forgot Password | ReduCera' },
    { property: 'og:description', content: 'Recover your ReduCera account and continue your cosmic journey.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: `${siteUrl}/forgot-password` },
    { property: 'og:image', content: '/meta/og-forgot-password.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Forgot Password | ReduCera' },
    { name: 'twitter:description', content: 'Recover your ReduCera account and continue your cosmic journey.' },
    { name: 'twitter:image', content: '/meta/og-forgot-password.png' },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
  ],
})

import { ref } from "vue"
import DownStarAnimation from "~/components/ui/DownStarAnimation.vue"
import ForgotPasswordForm from "~/components/auth/ForgotPasswordForm.vue"
import ResetPasswordForm from "~/components/auth/ResetPasswordForm.vue"

const successReset = ref(false)

</script>
