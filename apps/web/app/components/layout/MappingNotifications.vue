<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { BaseNotification } from '~/interfaces/notification'
import { notificationService } from '~/services/notifications'

const props = defineProps<{
  userId: string | undefined
}>()

const page = ref(1)
const limit = ref(5)
const readNotify = ref<BaseNotification | null>(null)

const queryKey = ['notifications']

const {
  data: resNotifications,
  isLoading,
  refetch
} = useQuery({
  queryKey,
  queryFn: () =>
    notificationService.findAll({
      userId: props.userId,
      page: page.value,
      limit: limit.value,
    }),
  enabled: computed(() => !!props.userId),
  refetchOnWindowFocus: false,
})

watch([page, limit, () => props.userId], () => {
  if (props.userId) refetch()
})

const queryClient = useQueryClient()

const notifications = computed(() => resNotifications.value?.data ?? [])
const pagination = computed(() => resNotifications.value?.pagination)

const nextPage = () => {
  if (!pagination.value) return
  if (page.value < Math.ceil(pagination.value.total / limit.value)) {
    page.value++
  }
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

const toggleReadNotify = async (notification: BaseNotification) => {
  readNotify.value = notification
  await notificationService.update(notification.id, { isRead: true })
  queryClient.invalidateQueries({ queryKey })
}

const toggleDeleteNotification = async () => {
  if (!readNotify.value) return
  await notificationService.delete(readNotify.value.id)
  readNotify.value = null
  queryClient.invalidateQueries({ queryKey })
}
</script>

<template>
  <UPopover>
    <UButton
      icon="i-heroicons-bell-alert-solid"
      :label="`${pagination?.total ?? 0}`"
      :ui="{ leadingIcon: 'text-primary' }"
      color="primary"
      variant="ghost"
      size="sm"
      class="cursor-pointer"
    />

    <template #content>
      <div class="p-4 w-72 relative">

        <div v-if="readNotify" class="flex items-center justify-between mb-2">
          <UButton
            @click="readNotify = null"
            size="xs"
            variant="ghost"
            color="secondary"
            icon="i-lucide-chevron-left"
          />
          <UButton
            size="xs"
            variant="soft"
            color="error"
            icon="i-lucide-trash"
            @click="toggleDeleteNotification"
          />
        </div>

        <div v-if="readNotify" class="p-2 border-b border-gray-700">
          <div class="font-semibold text-xs">{{ readNotify.title }}</div>
          <div class="text-[10px] opacity-70">{{ readNotify.body }}</div>
        </div>

        <div v-if="isLoading">
          <USkeleton class="h-16 w-full" />
        </div>
        <div v-if="!isLoading && !readNotify ">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="p-2 border-b border-gray-700 cursor-pointer hover:opacity-90 transition-all duration-100"
            @click="toggleReadNotify(item)"
          >
            <div class="font-semibold text-xs">{{ item.title }}</div>
            <div class="text-[10px] opacity-70">{{ item.body }}</div>
          </div>

          <div class="flex justify-between items-center mt-3">
            <UButton size="xs" @click="prevPage" :disabled="page === 1">
              Prev
            </UButton>

            <div class="text-xs opacity-70">
              Page {{ page }} /
              {{ Math.ceil((pagination?.total ?? 0) / limit) }}
            </div>

            <UButton
              size="xs"
              @click="nextPage"
              :disabled="page === Math.ceil((pagination?.total ?? 0) / limit)"
            >
              Next
            </UButton>
          </div>
        </div>
        <div v-if="notifications.length==0" class="text-xs font-bold">
          Dunia sedang tenang… belum ada notifikasi
        </div>
      </div>
    </template>
  </UPopover>
</template>
