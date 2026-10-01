<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { useQueryClient, useMutation } from '@tanstack/vue-query'
import { reactive } from 'vue'
import type { User } from '~/interfaces/auth'
import { LearningStyleSchema, type LearningStyleSchemaType } from '~/schemas/topic.schema'
import { learningStyleService } from '~/services/learning/learningStyle'
import { useLearning } from '~/stores/learning'

const props = defineProps<{
  userTopicId: string
}>()
const emit = defineEmits(['success'])


const user = useState<User | null>('user')
const learning=useLearning()

const form = reactive({
  userTopicId: props.userTopicId,
  visual: 5,
  auditory: 5,
  reading: 5,
  kinesthetic: 5,
  dominantStyle: '',
  takenAt: new Date()
})

const formItems = [
  { key: 'visual', label: 'Belajar dengan Melihat (Visual)' },
  { key: 'auditory', label: 'Belajar dengan Mendengar (Auditori)' },
  { key: 'reading', label: 'Belajar dengan Membaca & Menulis' },
  { key: 'kinesthetic', label: 'Belajar dengan Praktik (Kinestetik)' }
] as const

const queryClient = useQueryClient()
const toast = useToast()

const LearningStyleMutation = useMutation({
  mutationFn: (body: LearningStyleSchemaType) => {
    return learningStyleService.create(body)
  },
  onSuccess: (value:any) => {
    queryClient.invalidateQueries({
      queryKey: ['userTopic', user.value?.id]
    })

    if (!value.data || value.error) {
      throw new Error(value.message)
    }
    
    learning.setLearningStyle(value.data.id)

    toast.add({
      title: 'Berhasil Disimpan!',
      color: 'secondary',
      icon: 'i-heroicons-check-circle'
    })

    emit('success')
  },
  onError: (err: any) => {
    toast.add({
      title: err.message || 'Gagal menyimpan',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})

async function onSubmit(event: FormSubmitEvent<LearningStyleSchemaType>) {
  LearningStyleMutation.mutate(event.data)
}
</script>

<template>
  <UForm
    :schema="LearningStyleSchema"
    :state="form"
    @submit="onSubmit"
    class="w-full max-w-2xl mx-auto border-2 border-secondary/80 rounded-md p-4 space-y-4"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
      <UFormField
        v-for="(item, index) in formItems"
        :key="item.key"
        :name="item.key"
        :label="item.label"
        class="space-y-4"
      >
        <USlider
          v-model="form[item.key]"
          class="w-full"
          :min="1"
          :max="10"
          :step="1"
          tooltip
          :color="index % 2 === 0 ? 'primary' : 'secondary'"
        />
      </UFormField>
    </div>

    <UFormField
      name="dominantStyle"
      label="Gaya Belajar Dominan Kamu"
      class="mt-4 w-full space-y-4"
    >
      <UTextarea
        v-model="form.dominantStyle"
        color="warning"
        placeholder="Ceritakan hal-hal yang menggambarkan gaya belajarmu, misalnya: suka video, mudah terdistraksi, lebih nyaman membaca, atau suka belajar dengan praktik."
        class="resize-none w-full"
      />
    </UFormField>

    <UButton
      type="submit"
      color="success"
      variant="soft"
      :loading="LearningStyleMutation.isPending.value"
      icon="i-heroicons-sparkles"
      trailing-icon="i-heroicons-sparkles"
      :ui="{
        leadingIcon:'text-success animate-pulse',
        trailingIcon:'text-success animate-pulse'
      }"
      class="cursor-pointer ml-auto block font-semibold text-white"
    >
      Submit
    </UButton>
  </UForm>
</template>
