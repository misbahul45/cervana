<script setup lang="ts">
import { reactive, ref } from 'vue';
import AuthAlert from '~/components/auth/AuthAlert.vue';
import AuthField from '~/components/auth/AuthField.vue';
import { authMessage, fieldErrors } from '~/lib/auth-form';
import { ForgotPasswordSchema } from '~/schemas';
import { authService } from '~/services/auth';

const emit = defineEmits<{ sent: [email: string] }>();

const state = reactive({ email: '' });
const errors = ref<Record<string, string>>({});
const message = ref('');
const loading = ref(false);

async function onSubmit() {
  message.value = '';
  errors.value = fieldErrors(ForgotPasswordSchema, state);
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    const result = await authService.forgotPassword(state.email);
    if (result.success) {
      emit('sent', state.email);
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
    <AuthField id="forgot-email" v-model="state.email" label="Email" type="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" :error="errors.email" :disabled="loading" />
    <AuthAlert :message="message" tone="error" />
    <PlayButton type="submit" block :loading="loading">Kirim kode</PlayButton>
  </form>
</template>
