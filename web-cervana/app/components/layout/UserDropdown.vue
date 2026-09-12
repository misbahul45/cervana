<script setup lang="ts">
import { navigateTo } from '#app'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useApi } from '~/composable/useApi'
import type { User } from '~/interfaces/auth'
import { authService } from '~/services/auth'
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'

const props = defineProps<{
  user: User | null
}>()



const { call } = useApi(authService.logout)
const isLoggingOut = ref(false)

const queryClient=useQueryClient()

async function handleLogout() {
  const user = useState<User | null>('user')
  const skipCheck = useState<boolean>('skipCheck')

  skipCheck.value = true
  user.value = null

  try {
    await call()
    queryClient.clear()
    navigateTo(`/login`, { replace:true })
  } catch {}
}


const userDropdownItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: props.user?.name || 'User',
      avatar: { src: props.user?.image?.url || '' },
      type: 'label',
    },
  ],
  [
    { label: 'Profile', icon: 'i-lucide-user', to: '/learn/profile/me' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/learn/profile/settings' },
    { label: 'My Dashboard', icon: 'i-lucide-layout-dashboard', to: '/learn/profile/dashboard' },
  ],
  [
    isLoggingOut.value
      ? {
          label: 'Logging out...',
          icon: 'i-lucide-loader-2',
          color: 'neutral',
          disabled: true,
          class: 'animate-spin',
        }
      : {
          label: 'Logout',
          icon: 'i-lucide-log-out',
          color: 'error',
          onSelect: handleLogout,
        },
  ],
])

</script>

<template>
  <div class="flex items-center gap-2">
    <LayoutMappingUserTopic :user-id="props.user?.id" />

    <LayoutMappingNotifications :user-id="props.user?.id" />

    <UDropdownMenu
      :items="userDropdownItems"
      :content="{ align: 'center', side: 'bottom', sideOffset: 8 }"
      :ui="{ content: 'w-48' }"
    >
      <UAvatar
        :src="props.user?.image?.url"
        :alt="props.user?.name || 'User Avatar'"
        size="sm"
        class="cursor-pointer ring-1 ring-gray-300 hover:ring-primary transition-all"
      />
    </UDropdownMenu>
  </div>
</template>
