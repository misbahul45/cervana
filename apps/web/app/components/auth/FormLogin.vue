<script setup lang="ts">
import { reactive, ref } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import AuthField from '~/components/auth/AuthField.vue';
import type { CheckResponse, User } from '~/interfaces/auth';
import { authMessage, fieldErrors } from '~/lib/auth-form';
import { safeNext } from '~/lib/next-path';
import { SIGNED_IN_HOME } from '~/lib/route-meta';
import { LoginSchema } from '~/schemas';
import { authService } from '~/services/auth';

const state = reactive({ email: '', password: '' });
const errors = ref<Record<string, string>>({});
const message = ref('');
const loading = ref(false);
const user = useState<User | null>('user');
const route = useRoute();

async function onSubmit() {
  message.value = '';
  errors.value = fieldErrors(LoginSchema, state);
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    const login = await authService.login({ email: state.email, password: state.password });

    if (login.success) {
      const session = await authService.check();
      user.value = (session.data as CheckResponse | null)?.user ?? null;
      await navigateTo(safeNext(route.query.next) ?? SIGNED_IN_HOME, { replace: true });
      return;
    }

    if (login.message === 'Unverified email') {
      await authService.resendOtp(state.email, 'email');
      await navigateTo({ path: '/verify-email', query: { email: state.email } });
      return;
    }

    message.value = authMessage(login.message, login.meta?.statusCode);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="rc-auth__form" novalidate @submit.prevent="onSubmit">
    <AuthField id="login-email" v-model="state.email" label="Email" type="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" :error="errors.email" :disabled="loading" />
    <AuthField id="login-password" v-model="state.password" label="Kata sandi" type="password" autocomplete="current-password" :error="errors.password" :disabled="loading" />
    <AuthAlert :message="message" tone="error" />
    <PlayButton type="submit" block :loading="loading">Masuk</PlayButton>
    <NuxtLink to="/forgot-password" class="rc-auth__aside-link">Lupa kata sandi?</NuxtLink>
  </form>
</template>
