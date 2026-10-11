<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import AuthField from '~/components/auth/AuthField.vue';
import { useCooldown } from '~/composables/useCooldown';
import { authMessage, fieldErrors } from '~/lib/auth-form';
import { ResetPasswordSchema } from '~/schemas';
import { authService } from '~/services/auth';

const props = defineProps<{ email: string }>();

const state = reactive({ identifier: props.email, otp: '', newPassword: '', confirmPassword: '' });
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
  errors.value = fieldErrors(ResetPasswordSchema, state);
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    const result = await authService.resetPassword({ ...state });
    if (result.success) {
      await navigateTo({ path: '/login', query: { reset: '1' } });
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
  const result = await authService.resendOtp(state.identifier, 'pw');
  if (result.success) {
    notice.value = 'Jika email terdaftar, kode baru sedang dikirim.';
    cooldown.start();
    return;
  }
  message.value = authMessage(result.message, result.meta?.statusCode);
}
</script>

<template>
  <form class="rc-auth__form" novalidate @submit.prevent="onSubmit">
    <AuthField id="reset-otp" v-model="state.otp" label="Kode 6 angka" autocomplete="one-time-code" inputmode="numeric" :maxlength="6" :hint="`Kode dikirim ke ${props.email}.`" :error="errors.otp" :disabled="loading" />
    <AuthField id="reset-password" v-model="state.newPassword" label="Kata sandi baru" type="password" autocomplete="new-password" hint="Minimal 8 karakter." :error="errors.newPassword" :disabled="loading" />
    <AuthField id="reset-confirm" v-model="state.confirmPassword" label="Ulangi kata sandi baru" type="password" autocomplete="new-password" :error="errors.confirmPassword" :disabled="loading" />
    <AuthAlert :message="notice" tone="success" />
    <AuthAlert :message="message" tone="error" />
    <PlayButton type="submit" block :loading="loading">Simpan kata sandi baru</PlayButton>
    <button type="button" class="rc-auth__linkbtn" :disabled="cooldown.active.value" @click="resend">
      {{ cooldown.active.value ? `Kirim ulang kode (${cooldown.remaining.value} dtk)` : 'Kirim ulang kode' }}
    </button>
  </form>
</template>
