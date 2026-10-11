<script setup lang="ts">
import FormRegister from '~/components/auth/FormRegister.vue';

definePageMeta({
  title: 'Daftar | ReduCera',
  protection: { kind: 'guest-only' },
  layout: 'auth',
});

useHead({
  title: 'Daftar | ReduCera',
  meta: [{ name: 'description', content: 'Buat akun ReduCera dan mulai belajar akuntansi dengan XP, streak, dan pencapaian yang dihitung dari penguasaanmu.' }],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
});
</script>

<template>
  <div class="rc-auth__panel">
    <div class="rc-auth__head">
      <h1 class="rc-auth__title">Buat akun</h1>
      <p class="rc-auth__switch">
        Sudah punya akun?
        <NuxtLink to="/login">Masuk</NuxtLink>
      </p>
    </div>
    <p class="rc-auth__lead">Mulai dari satu konsep.</p>
    <FormRegister />
  </div>
</template>
