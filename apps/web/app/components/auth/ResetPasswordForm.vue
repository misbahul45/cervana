<template>
  <div class="w-full max-w-md space-y-4 z-10 py-20 text-center">
    <h1 class="title font-exo2 font-bold text-2xl text-primary drop-shadow-md">
      ⚔️ Bangkitlah, Kesatria! ⚔️
    </h1>
    <p class="text-sm text-gray-300 font-medium">
      Pulihkan aksesmu dengan kata sandi baru yang lebih kuat.
    </p>

    <UForm
      :schema="ResetPasswordSchema"
      :state="state"
      class="space-y-4 mt-6"
      @submit.prevent="onSubmit"
    >
      <UFormField
        v-for="field in fields"
        :key="field.name"
        class="space-y-1 w-full text-left"
        :label="field.label"
        :name="field.name"
      >
        <div class="w-full relative">
          <UInput
            v-model="state[field.name as keyof ResetPasswordSchemaType]"
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

      <UButton
        size="md"
        color="neutral"
        variant="outline"
        :loading="loading"
        :disabled="loading"
        icon="i-lucide-swords"
        class="w-full py-2 font-semibold cursor-pointer flex items-center justify-center gap-2"
        type="submit"
      >
        {{ loading ? 'Menyegel Kekuatan...' : 'Aktifkan Kata Sandi Baru ⚔️' }}
      </UButton>
    </UForm>
    <p class="text-sm text-gray-400 mt-1">
        Tidak menerima OTP?
        <button type="button" class="text-primary underline cursor-pointer" @click="resendOtp">
            Kirim ulang OTP
        </button>
    </p>
  </div>
</template>



<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { ref, reactive } from 'vue'
import { useApi } from '~/composable/useApi'
import { ResetPasswordSchema, type ResetPasswordSchemaType } from '~/schemas'
import { authService } from '~/services/auth'

const showPassword = ref(false)
const showConfirmPassword = ref(false)

const route = useRoute()

const state = reactive<ResetPasswordSchemaType>({
  identifier: route.query.email as string,
  otp: '',
  newPassword: '',
  confirmPassword: ''
})


const { call, respon, loading } = useApi(authService.resetPassword)
const resendAction = useApi(authService.resendOtp)

const fields = [
  { name: 'identifier', label: 'Email', placeholder: 'Masukkan email kamu', type: 'email' },
  { name: 'otp', label: 'Kode OTP', placeholder: 'Masukkan kode OTP', type: 'text' },
  { name: 'newPassword', label: 'Kata Sandi Baru', placeholder: 'Masukkan kata sandi baru', type: 'password' },
  { name: 'confirmPassword', label: 'Konfirmasi Kata Sandi', placeholder: 'Masukkan ulang kata sandi', type: 'password' }
]

const toast=useToast()

const onSubmit=async(event: FormSubmitEvent<ResetPasswordSchemaType>)=>{
    await call({
        ...event.data
    })
}

const resendOtp = async () => {
  resendAction.call(state.identifier,'pw')
  toast.add({
    title: 'OTP Dikirim Ulang',
    icon: 'i-lucide-mail-check',
    color: 'info'
  })
}

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

watch(respon,async(newVal)=>{
    if(!newVal) return
    if(newVal?.success){
        toast.add({
            title: newVal.message,
            color: "success",
            icon: "i-lucide-check-circle",
        })
        navigateTo('/login')
    }else{
        toast.add({
            title: newVal?.message,
            color: "error",
            icon: "i-lucide-x-circle",
        })
    }
})
</script>
