<template>
  <section class="w-full pt-12 relative flex flex-col justify-center items-center h-screen overflow-hidden">
    <div class="universe-bg absolute inset-0 -z-10"></div>
    <Sunset/>

    <div class="w-full max-w-2xl mx-auto backdrop-blur-md rounded-lg p-8 shadow-lg relative z-10">
      <h1 class="font-exo2 text-center mb-4 title font-bold">
        Verifikasi OTP
      </h1>
      <p v-if="step === 1" class="md:text-base text-sm font-medium text-primary text-center">
         Masukkan email kamu untuk memulai petualangan!
      </p>

      <p v-if="step === 2" class="text-sm md:text-base text-primary text-center">
         Periksa kotak masuk email kamu untuk kode OTP rahasia!
      </p>

      <UForm :schema="VerificationSchema" :state="state" @submit="onSubmit" class="space-y-6 w-full mx-auto mt-8 p-6 rounded-lg shadow-xl border border-primary/30 bg-black/50">
        <UFormField v-if="step === 1" label="Email" name="identifier" class="w-full">
          <UInput
            v-model="state.identifier"
            type="email"
            placeholder="Masukkan email kamu"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <div v-if="step === 2">
          <UFormField label="Kode OTP" name="otp" class="w-full">
            <UInput
              v-model="state.otp"
              type="text"
              placeholder="Masukkan kode OTP"
              size="xl"
              class="w-full py-2"
            />
          </UFormField>
          <p
          v-if="responVerify?.message"
          :class="['font-medium text-sm',responVerify.success?'text-primary':'text-red-500']"
          >{{ responVerify?.message }}
          </p>

          <p class="text-sm text-gray-400 mt-1">
            Tidak menerima OTP?
            <button type="button" class="text-primary underline cursor-pointer" @click="resendOtp">
              Kirim ulang OTP
            </button>
          </p>
        </div>

        <div class="flex justify-end">
          <UButton
            :type="step === 1 ? 'button' : 'submit'"
            size="xl"
            :ui="{
              leadingIcon: loading?'text-gray-400':'text-primary' ,
            }"
            :loading="loading"
            :disabled="loading"
            color="neutral"
            variant="outline"
            :icon="step === 1 ? 'i-lucide-arrow-right' : 'i-lucide-check'"
            :class="['py-2 font-semibold cursor-pointer flex items-center justify-center gap-2', loading ? 'cursor-not-allowed' : 'hover:bg-primary/10']"
            @click="step === 1 && goToOtp()"
          >
            {{ loading ? 'Memverifikasi...' : (step === 1 ? 'Lanjut' : 'Verifikasi') }}
          </UButton>
        </div>
      </UForm>
    </div>
    <DownStarAnimation />
  </section>
</template>

<script lang="ts" setup>
import type { FormSubmitEvent } from '@nuxt/ui'
import { reactive, ref } from 'vue'
import { VerificationSchema, type VerificationSchemaType } from '~/schemas'
import { authService } from '~/services/auth'
import DownStarAnimation from '~/components/ui/DownStarAnimation.vue'
import { useApi } from '~/composable/useApi'
import Sunset from '~/components/ui/Sunset.vue'
useHead({
  title: 'Verify Your Email | Cervana',
  meta: [
    {
      name: 'description',
      content:
        'Confirm your email to activate your Cervana account and unlock your path to the stars of knowledge.',
    },
    { name: 'keywords', content: 'Cervana, verify email, activation, AI learning' },
    { property: 'og:title', content: 'Verify Your Email | Cervana' },
    { property: 'og:description', content: 'Activate your Cervana account and embark on your cosmic learning adventure.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://cervana.ai/verify-email' },
    { property: 'og:image', content: '/meta/og-verify-email.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Verify Your Email | Cervana' },
    { name: 'twitter:description', content: 'Activate your Cervana account and embark on your cosmic learning adventure.' },
    { name: 'twitter:image', content: '/meta/og-verify-email.png' },
  ],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
})


const router = useRouter()
const step = ref(1)
const toast = useToast()

const { call: callVerify, loading, respon: responVerify } = useApi(authService.verifyOtp)
const resendAction = useApi(authService.resendOtp)
const errorMessage = ref('')

const state = reactive<{
  identifier: string
  otp: string
}>({
  identifier: router.currentRoute.value.query.email as string || "",
  otp: "",
})

watch(() => state.identifier, (newVal) => {
  if (newVal) {
    step.value = 2
  }
}, { immediate: true })

const goToOtp = () => {
  if (!state.identifier) {
    errorMessage.value = 'Silakan masukkan email terlebih dahulu'
    return
  }
  step.value = 2
}

const onSubmit = async (event: FormSubmitEvent<VerificationSchemaType>) => {
  await callVerify(event.data)
}

watch(responVerify, (newVal) => {
  if (newVal?.success) {
    router.push('/login')
  }
})

const resendOtp = async () => {
  resendAction.call(state.identifier, 'email')
  toast.add({
    title: 'OTP Dikirim Ulang',
    icon: 'i-lucide-mail-check',
    color: 'info'
  })
}
</script>
