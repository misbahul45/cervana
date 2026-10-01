<template>
  <div class="w-full max-w-md space-y-3 z-10">
    <h1 class="title font-semibold mb-1 text-center text-md">Lupa Kata Sandi</h1>
    <p class="text-primary text-center text-sm">
      Masukkan alamat email kamu untuk mengatur ulang kata sandi.
    </p>

    <UForm
      :schema="ForgotPasswordSchema"
      :state="state"
      @submit="onSubmit"
      class="space-y-4 mt-4"
    >
      <UFormField label="Email" name="email" class="w-full backdrop-blur">
        <UInput
          size="md"
          v-model="state.email"
          type="email"
          placeholder="Alamat email"
          class="w-full py-1.5 text-sm"
        />
      </UFormField>

      <div class="flex justify-end">
        <UButton
          size="md"
          color="neutral"
          variant="outline"
          :ui="{ leadingIcon: 'text-primary' }"
          icon="i-lucide-rocket"
          type="submit"
          class="py-1.5 px-3 text-sm font-semibold cursor-pointer"
          :disabled="loading"
          :loading-auto="loading"
        >
          Kirim Kode OTP
        </UButton>
      </div>
    </UForm>

    <p class="text-center font-medium font-robotomono text-sm">
      Sudah ingat kata sandi?
      <NuxtLink to="/login" class="text-primary text-sm">Masuk</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { reactive, watch } from "vue"
import { useApi } from "~/composable/useApi"
import { ForgotPasswordSchema, type ForgotPasswordSchemaType } from "~/schemas"
import { authService } from '~/services/auth'

const emit = defineEmits<{
  (e: "success"): void
}>()

const state = reactive<{ email: string }>({
  email: "",
})


const router=useRouter()
const toast = useToast()
const { call, respon, loading } = useApi(authService.forgotPassword)

async function onSubmit(event: FormSubmitEvent<ForgotPasswordSchemaType>) {
  await call(event.data.email)
}

watch(respon, (newVal) => {
  if (!newVal) return
  if (newVal.success) {
    toast.add({
      title: "Kode OTP berhasil dikirim, periksa email kamu",
      color: "success",
      icon: "i-lucide-mail-check",
    })
    router.push({
      path: "/forgot-password",
      query: { email: state.email }
    })
    emit("success")
  } else if (newVal.message?.toLowerCase().includes("not found")) {
    toast.add({
      title: "Email tidak ditemukan",
      color: "warning",
      icon: "i-lucide-alert-circle",
    })
  } else {
    toast.add({
      title: "Gagal mengirim kode OTP",
      color: "error",
      icon: "i-lucide-x-circle",
    })
  }
})
</script>
