<script setup lang="ts">
import { ref } from 'vue';
import ForgotPasswordForm from '~/components/auth/ForgotPasswordForm.vue';
import ResetPasswordForm from '~/components/auth/ResetPasswordForm.vue';

definePageMeta({
  title: 'Lupa kata sandi | ReduCera',
  protection: { kind: 'guest-only' },
  layout: 'auth',
});

useHead({
  title: 'Lupa kata sandi | ReduCera',
  meta: [{ name: 'description', content: 'Atur ulang kata sandi akun ReduCera-mu dengan kode yang dikirim ke email.' }],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
});

const route = useRoute();
const email = ref(typeof route.query.email === 'string' ? route.query.email : '');
const sent = ref(false);

function onSent(address: string) {
  email.value = address;
  sent.value = true;
}
</script>

<template>
  <div class="rc-auth__panel">
    <template v-if="!sent">
      <div class="rc-auth__head">
        <h1 class="rc-auth__title">Lupa kata sandi</h1>
        <p class="rc-auth__switch">
          Ingat kata sandi?
          <NuxtLink to="/login">Masuk</NuxtLink>
        </p>
      </div>
      <p class="rc-auth__lead">Masukkan email akunmu. Jika terdaftar, kami kirim kode 6 angka yang berlaku 15 menit.</p>
      <ForgotPasswordForm @sent="onSent" />
    </template>
    <template v-else>
      <div class="rc-auth__head">
        <h1 class="rc-auth__title">Kata sandi baru</h1>
      </div>
      <p class="rc-auth__lead">Masukkan kode dari emailmu, lalu pilih kata sandi baru. Semua perangkat akan keluar otomatis.</p>
      <ResetPasswordForm :email="email" />
    </template>
  </div>
</template>
