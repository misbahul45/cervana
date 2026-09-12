<template>
  <div class="w-full space-y-4 max-w-md mx-auto">
    <UForm
      :schema="RegisterSchema"
      :state="state"
      class="space-y-4 w-full"
      @submit="onSubmit"
    >
      <UFormField
        v-for="field in fields"
        :key="field.name"
        class="space-y-1 w-full relative"
        :label="field.label"
        :name="field.name"
      >
        <div class="w-full relative">
          <UInput
            v-model="state[field.name] as string"
            :type="getInputType(field.name)"
            :placeholder="field.placeholder"
            size="md"
            class="w-full py-1.5 text-sm"
          />
          <UButton
            size="sm"
            variant="ghost"
            :disabled="loading"
            v-if="field.name === 'password' || field.name === 'confirmPassword'"
            @click="togglePassword(field.name)"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 cursor-pointer select-none"
          >
            <UIcon
              :name="isPasswordVisible(field.name) ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              class="w-4 h-4"
            />
          </UButton>
        </div>
      </UFormField>

      <div class="flex items-center gap-2">
        <UCheckbox
          size="md"
          v-model="state.agree"
          name="agree"
          class="text-white"
        />
        <span class="text-xs text-white/80">
          Saya menyetujui <a href="#" class="text-primary/60 hover:underline">Syarat & Ketentuan</a>
        </span>
      </div>

      <UButton
        size="md"
        variant="solid"
        type="submit"
        :class="['w-full py-2 cursor-pointer transition-all duration-200', loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]']"
      >
        <span class="text-sm font-semibold text-center w-full">
          {{ loading ? 'Hampir selesai, tunggu sebentar...' : 'Luncurkan Misi Belajarmu' }}
        </span>
      </UButton>

      <p
        v-if="respon || errorMessage"
        :class="['text-xs my-2 font-medium font-robotmono text-start', respon?.success ? 'text-green-500' : 'text-red-500']"
      >
        {{ errorMessage || respon?.message }}
      </p>
    </UForm>

    <div class="flex items-center gap-2">
      <span class="flex-1 h-px bg-white/20" />
      <span class="text-white/70 text-xs font-medium">ATAU</span>
      <span class="flex-1 h-px bg-white/20" />
    </div>
    
    <button
      @click="loginDenganGoogle"
      :disabled="isGoogleLoading"
      class="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-xl text-white border border-white/20 hover:bg-white hover:text-black hover:border-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg backdrop-blur-sm bg-white/5 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>Lanjutkan dengan Google</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { reactive, ref, watch } from 'vue'
import { RegisterSchema, type RegisterSchemaType } from '~/schemas'
import { authService } from '~/services/auth'
import { useApi } from '~/composable/useApi'
import { useRouter } from 'vue-router'
import { getApiUrl } from '~/lib/api'

const router = useRouter()
const state = reactive<{ 
  name: string
  email: string
  password: string
  confirmPassword: string
  agree: boolean
  [key: string]: string | boolean
}>({ name: '', email: '', password: '', confirmPassword: '', agree: false })

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isGoogleLoading = ref(false)
const errorMessage = ref('')

const fields = [
  { name: 'name', label: 'Nama', placeholder: 'Masukkan nama kamu', type: 'text' },
  { name: 'email', label: 'Email', placeholder: 'Masukkan email kamu', type: 'email' },
  { name: 'password', label: 'Kata Sandi', placeholder: 'Masukkan kata sandi kamu', type: 'password' },
  { name: 'confirmPassword', label: 'Konfirmasi Kata Sandi', placeholder: 'Masukkan ulang kata sandi kamu', type: 'password' }
]

const { respon, loading, call } = useApi(authService.register)

async function onSubmit(event: FormSubmitEvent<RegisterSchemaType>) {
  const { agree, ...res } = event.data
  if(!agree) errorMessage.value = 'Kamu harus menyetujui syarat dan ketentuan sebelum mendaftar.'
  await call(res)
}

watch(respon, (newVal)=>{
  if(newVal?.success) setTimeout(()=>{ router.push(`/verify-email?email=${state.email}`) }, 1000)
})

function getInputType(field: string) {
  if (field === 'password') return showPassword.value ? 'text' : 'password'
  if (field === 'confirmPassword') return showConfirmPassword.value ? 'text' : 'password'
  return fields.find(f => f.name === field)?.type || 'text'
}

function togglePassword(field: string) {
  if (field === 'password') showPassword.value = !showPassword.value
  if (field === 'confirmPassword') showConfirmPassword.value = !showConfirmPassword.value
}

function isPasswordVisible(field: string) {
  return (field === 'password' && showPassword.value) || (field === 'confirmPassword' && showConfirmPassword.value)
}

async function loginDenganGoogle() {
  const API_URL = getApiUrl();
  window.location.href = `${API_URL}/auth/google`;
}
</script>
