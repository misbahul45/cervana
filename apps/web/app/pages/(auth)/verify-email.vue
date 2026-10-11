<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import AuthField from '~/components/auth/AuthField.vue';
import { useCooldown } from '~/composables/useCooldown';
import { authMessage, fieldErrors } from '~/lib/auth-form';
import { VerificationSchema } from '~/schemas';
import { authService } from '~/services/auth';

definePageMeta({
  title: 'Verifikasi email | ReduCera',
  protection: { kind: 'guest-only' },
  layout: 'auth',
});

useHead({
  title: 'Verifikasi email | ReduCera',
  meta: [{ name: 'description', content: 'Masukkan kode 6 angka dari emailmu untuk mengaktifkan akun ReduCera.' }],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' }],
});

const route = useRoute();
const state = reactive({
  identifier: typeof route.query.email === 'string' ? route.query.email : '',
  otp: '',
});
const hasEmail = Boolean(state.identifier);
const errors = ref<Record<string, string>>({});
const message = ref('');
const notice = ref('');
const loading = ref(false);
const cooldown = useCooldown(60);

watch(
  () => state.otp,
  (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits !== value) state.otp = digits;
  },
);

async function onSubmit() {
  message.value = '';
  notice.value = '';
  errors.value = fieldErrors(VerificationSchema, state);
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    const result = await authService.verifyOtp({ ...state });
    if (result.success) {
      await navigateTo({ path: '/login', query: { verified: '1' } });
      return;
    }
    message.value = authMessage(result.message, result.meta?.statusCode);
  } finally {
    loading.value = false;
  }
}

async function resend() {
  if (cooldown.active.value) return;
  message.value = '';
  errors.value = fieldErrors(VerificationSchema.pick({ identifier: true }), state);
  if (errors.value.identifier) return;

  const result = await authService.resendOtp(state.identifier, 'email');
  if (result.success) {
    notice.value = 'Jika email terdaftar dan belum terverifikasi, kode baru sedang dikirim.';
    cooldown.start();
    return;
  }
  message.value = authMessage(result.message, result.meta?.statusCode);
}
</script>

<template>
  <div class="rc-auth__panel">
    <div class="rc-auth__head">
      <h1 class="rc-auth__title">Verifikasi email</h1>
      <p class="rc-auth__switch">
        Sudah terverifikasi?
        <NuxtLink to="/login">Masuk</NuxtLink>
      </p>
    </div>
    <p class="rc-auth__lead">
      <template v-if="hasEmail">Masukkan kode 6 angka yang dikirim ke {{ state.identifier }}. Kode berlaku 15 menit.</template>
      <template v-else>Masukkan email akunmu dan kode 6 angka dari emailmu.</template>
    </p>
    <form class="rc-auth__form" novalidate @submit.prevent="onSubmit">
      <AuthField v-if="!hasEmail" id="verify-email" v-model="state.identifier" label="Email" type="email" autocomplete="email" inputmode="email" :error="errors.identifier" :disabled="loading" />
      <AuthField id="verify-otp" v-model="state.otp" label="Kode 6 angka" autocomplete="one-time-code" inputmode="numeric" :maxlength="6" :error="errors.otp" :disabled="loading" />
      <AuthAlert :message="notice" tone="success" />
      <AuthAlert :message="message" tone="error" />
      <PlayButton type="submit" block :loading="loading">Verifikasi</PlayButton>
      <button type="button" class="rc-auth__linkbtn" :disabled="cooldown.active.value" @click="resend">
        {{ cooldown.active.value ? `Kirim ulang kode (${cooldown.remaining.value} dtk)` : 'Kirim ulang kode' }}
      </button>
    </form>
  </div>
</template>
