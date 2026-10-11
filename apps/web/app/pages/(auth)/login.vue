<script setup lang="ts">
import { computed } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import FormLogin from '~/components/auth/FormLogin.vue';

definePageMeta({
  title: 'Masuk | ReduCera',
  protection: { kind: 'guest-only' },
  layout: 'auth',
});

useHead({
  title: 'Masuk | ReduCera',
  meta: [{ name: 'description', content: 'Masuk ke ReduCera untuk melanjutkan belajar dan menjaga streak-mu.' }],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
});

const route = useRoute();

const notice = computed(() => {
  if (route.query.reset) return 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.';
  if (route.query.verified) return 'Email terverifikasi. Silakan masuk.';
  return '';
});
</script>

<template>
  <div class="rc-auth__panel">
    <div class="rc-auth__head">
      <h1 class="rc-auth__title">Masuk</h1>
      <p class="rc-auth__switch">
        Belum punya akun?
        <NuxtLink to="/register">Daftar</NuxtLink>
      </p>
    </div>
    <p class="rc-auth__lead">Lanjutkan belajarmu dan jaga streak-mu.</p>
    <AuthAlert :message="notice" tone="success" />
    <FormLogin />
  </div>
</template>
