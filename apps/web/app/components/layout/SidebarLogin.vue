<script setup lang="ts">
import { sidebarItems } from '~/constants'
import { useRoute } from '#imports'
import { ref } from 'vue'

const router = useRoute()
const isOpen = ref(false)
const toggleSidebar = () => (isOpen.value = !isOpen.value)
</script>

<template>
  <aside
    class="hidden  md:flex fixed bg-background/40 z-50 px-2.5 py-2 top-1/2 gap-2 -translate-y-1/2 h-[70%] left-4 rounded-full flex-col items-center justify-center bg-white/5 backdrop-blur-xl border-2 border-primary/80 shadow-xl"
  >
    <NuxtLink
      v-for="item in sidebarItems"
      :key="item.id"
      :to="item.href"
      class="p-2 cursor-pointer"
    >
      <UTooltip
        :text="item.label"
        :content="{ side: 'right', sideOffset: 8, updatePositionStrategy: 'always' }"
      >
        <UIcon
          :class="[
            'hover:text-primary transition-all duration-200',
            router.path === item.href ? 'text-primary' : 'text-white'
          ]"
          :name="item.icon"
          size="sm"
        />
      </UTooltip>
    </NuxtLink>
  </aside>

  <button
    v-if="!isOpen"
    @click="toggleSidebar"
    :class="['md:hidden fixed z-50 top-16 left-1 p-2 rounded-full bg-secondary flex items-center justify-center text-white shadow-2xl active:scale-95 transition-all duration-300 overflow-hidden', !isOpen?'translate-x-0':'translate-x-full']"
  >
    <UIcon name="i-heroicons-sparkles-solid" size="lg" class="relative animate-pulse" />
  </button>

    <aside
        v-if="isOpen"
        :class="['flex md:hidden fixed z-50 px-1.5 py-2 top-1/2 gap-2 -translate-y-1/2 h-[70%] left-4 rounded-full flex-col items-center justify-center bg-white/5 backdrop-blur-xl border-2 border-primary/10 shadow-xl',isOpen?'opacity-100':'opacity-0']"
    >
        <button
        @click="toggleSidebar"
        class="absolute -top-10 left-1/2 -translate-x-1/2 text-white hover:text-primary transition-colors"
        >
        <UIcon name="i-heroicons-x-mark-20-solid" size="md" />
        </button>

        <NuxtLink
        v-for="item in sidebarItems"
        :key="item.id"
        :to="item.href"
        class="p-2 cursor-pointer"
        @click="toggleSidebar"
        >
        <UTooltip
            :text="item.label"
            :content="{ side: 'right', sideOffset: 8, updatePositionStrategy: 'always' }"
        >
            <UIcon
            :class="[
                'hover:text-primary transition-all duration-200',
                router.path === item.href ? 'text-primary' : 'text-white'
            ]"
            :name="item.icon"
            size="sm"
            />
        </UTooltip>
        </NuxtLink>
    </aside>
</template>
