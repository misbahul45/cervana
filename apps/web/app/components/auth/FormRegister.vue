<script setup lang="ts">
import { reactive, ref } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import AuthField from '~/components/auth/AuthField.vue';
import { authMessage, fieldErrors } from '~/lib/auth-form';
import { RegisterSchema } from '~/schemas';
import { authService } from '~/services/auth';

const state = reactive({ name: '', email: '', password: '', confirmPassword: '', agree: false });
const errors = ref<Record<string, string>>({});
const message = ref('');
const loading = ref(false);

async function onSubmit() {
  message.value = '';
  errors.value = fieldErrors(RegisterSchema, state);
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    const { agree: _agree, ...payload } = state;
    const result = await authService.register(payload);

    if (result.success) {
      await navigateTo({ path: '/verify-email', query: { email: state.email } });
      return;
    }

    message.value = authMessage(result.message, result.meta?.statusCode);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="rc-auth__form" novalidate @submit.prevent="onSubmit">
    <AuthField id="register-name" v-model="state.name" label="Nama lengkap" autocomplete="name" :error="errors.name" placeholder="xninetzy" :disabled="loading" />
    <AuthField id="register-email" v-model="state.email" label="Email" type="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" :error="errors.email" :disabled="loading" />
    <AuthField id="register-password" v-model="state.password" label="Kata sandi" type="password" autocomplete="new-password" hint="Minimal 8 karakter." placeholder="********" :error="errors.password" :disabled="loading" />
    <AuthField id="register-confirm" v-model="state.confirmPassword" label="Ulangi kata sandi" type="password" autocomplete="new-password" placeholder="********" :error="errors.confirmPassword" :disabled="loading" />
    <div class="rc-authfield">
      <label class="rc-check" for="register-agree">
        <input id="register-agree" v-model="state.agree" type="checkbox" :disabled="loading" :aria-invalid="errors.agree ? 'true' : undefined" aria-describedby="register-agree-error" />
        <span>Saya setuju memakai ReduCera untuk belajar dan data belajar saya disimpan untuk menghitung kemajuan.</span>
      </label>
      <p v-if="errors.agree" id="register-agree-error" class="rc-error-text" role="alert">{{ errors.agree }}</p>
    </div>
    <AuthAlert :message="message" tone="error" />
    <PlayButton type="submit" block :loading="loading">Buat akun</PlayButton>
  </form>
</template>
