<template>
  <header
    :class="[
      'w-full max-w-[99%] sm:max-w-[95%] xl:max-w-8xl py-2 pl-3 pr-2 sm:px-4 flex justify-between items-center fixed top-2 rounded-full left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
      isScrolling ? 'backdrop-blur-md bg-background/20 border-2 border-primary/10 shadow-xl' : ''
    ]"
  >
    <div class="flex items-center gap-3">
      <NuxtLink :to="user ? '/learn/topics' : '/'" class="cursor-pointer hover:scale-105 transition-all duration-100">
        <div class="relative w-32 h-10">
          <NuxtImg
            src="/pictures/logo.svg"
            class="w-28 absolute inset-0 top-3 m-auto"
          />
        </div>
      </NuxtLink>
      <div class="sm:w-56 w-fit md:w-sm relative items-center md:block hidden">
          <input
            v-model="search"
            type="text"
            placeholder="Search topics..."
            class="w-full py-2 px-4 text-sm rounded-full bg-secondary/5 outline-none border-primary/60 ring-2 ring-primary/30"
          />
          <button @click="goSearch" class="size-8 flex items-center justify-center absolute top-1/2 cursor-pointer rounded-full -translate-y-1/2 bg-primary/60 hover:bg-primary/70 hover:scale-105 text-white right-2 transition-all duration-200">
            <UIcon name="i-lucide-search"/>
          </button>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <template v-if="!user">
        <div class="relative hidden sm:block">
          <div
            class="relative inline-block"
            @mouseenter="showDropdown"
            @mouseleave="scheduleHideDropdown"
          >
            <UButton
              icon="i-ph-meteor-duotone"
              v-if="!isScrolling"
              variant="outline"
              class="w-28 sm:w-36 text-center rounded-full text-sm"
            >
              <p :class="[
                'truncate text-center text-white w-full',
                isLoading?'animate-pulse':''
              ]">{{ isLoading?'Loading...': categoryRes?.error ?'Categories':selectedCategoryName }}</p>
            </UButton>

            <transition name="fade">
              <div
                v-if="isDropdownVisible && !isScrolling"
                @mouseenter="cancelHideDropdown"
                @mouseleave="scheduleHideDropdown"
                class="absolute right-0 top-full mt-1.5 w-[250px] sm:w-[350px] md:w-[500px] flex flex-col sm:flex-row text-white shadow-lg rounded-lg overflow-hidden bg-primary/20 backdrop-blur-sm border border-white/10 z-50"
              >
                <div
                  class="w-full space-y-1.5 p-2 sm:w-[40%] text-sm border-b sm:border-b-0 sm:border-r border-white/20"
                >
                  <UButton
                    v-for="category in categories"
                    :key="category.id"
                    variant="outline"
                    @mouseenter="handleCategoryHover(category.id)"
                    class="block w-full text-left text-white font-semibold px-3 py-1.5 hover:bg-white/10 text-sm truncate"
                  >
                    {{ category.name }}
                  </UButton>
                </div>

                <div class="w-full p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <NuxtLink
                    v-for="(item, index) in showTopics"
                    :key="index"
                    :to="`/app/topics/${item.slug}/detail`"
                    class="truncate text-xs font-medium hover:text-secondary"
                  >
                    <p class="truncate">{{ item.title }}</p>
                    <div
                      v-html="item.description"
                      class="text-[10px] opacity-80 truncate line-clamp-2"
                    />
                  </NuxtLink>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <NuxtLink
          v-if="isScrolling"
          to="/login"
          v-motion
          :initial="{ opacity: 0, y: 100, scale: 0.95 }"
          :enter="{ opacity: 1, y: 0, scale: 1 }"
        >
          <UButton
            icon="i-lucide-rocket"
            variant="outline"
            size="lg"
            class="cursor-pointer rounded-full py-1.5 px-3 sm:px-4 text-xs sm:text-sm"
          >
            Belajar
          </UButton>
        </NuxtLink>

        <div class="relative sm:hidden">
          <UButton
            v-if="!isScrolling"
            icon="i-lucide-menu"
            variant="outline"
            size="lg"
            class="cursor-pointer py-1.5 px-3"
            @click="toggleMobileDropdown"
          />

          <transition name="fade">
            <div
              v-if="isMobileDropdownVisible"
              class="absolute right-2 top-12 w-[80vw] max-w-sm backdrop-blur-md bg-primary/20 border border-white/10 rounded-lg p-3 shadow-lg z-50"
            >
              <div class="flex flex-col gap-2">
                <h3 class="font-semibold text-center">The Core</h3>
                <div v-for="category in categories" :key="category.id">
                  <button
                    @click="toggleCategory(category.id)"
                    class="w-full text-left text-white text-sm py-1.5 px-2 hover:bg-white/10 rounded-md flex justify-between items-center"
                  >
                    <span>{{ category.name }}</span>
                    <span class="text-xs opacity-70">
                      {{ selectCategory === category.id ? '-' : '+' }}
                    </span>
                  </button>

                  <ul
                    v-if="selectCategory === category.id"
                    :class="['pl-3 space-y-1 mt-1 transition-all duration-200 ', selectCategory===category.id ?'scale-y-100':'scale-y-0']"
                  >
                    <li
                      v-for="(item, index) in showTopics"
                      :key="index"
                    >
                      <NuxtLink
                        :to="`/app/topics/${item.slug}/detail`"
                        class="block text-xs text-white/80 hover:text-secondary truncate"
                      >
                        {{ item.title }}
                      </NuxtLink>    
                    </li>
                  </ul>
                </div>
              </div>
              <div class="flex gap-4 items-center mt-4">
                <NuxtLink href="/login">
                  <UButton variant="soft" icon="i-lucide-rocket" class="flex-1 text-[10px]">
                    Launch Mission
                  </UButton>
                </NuxtLink>
                <NuxtLink href="/register">
                  <UButton variant="solid" icon="i-lucide-user" class="flex-1 text-[10px]">
                    Join the Crew
                  </UButton>
                </NuxtLink>
              </div>
            </div>
          </transition>
        </div>
      </template>

      <template v-else>
        <UserDropdown :user="user" />
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { categoriesService } from '~/services/categories'
import type { CategoryDetailResponse } from '~/interfaces/categories'
import type { BaseTopic } from '~/interfaces/curriculum/topics'
import type { User } from '~/interfaces/auth'
import UserDropdown from './UserDropdown.vue'

const user = useState<User | null>('user')
const isScrolling = ref(false)
const selectCategory = ref<string>('')
const isDropdownVisible = ref(false)
const isMobileDropdownVisible = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null
const search=ref('')
const router=useRouter()

const { data: categoryRes, isLoading, isError } = useQuery({
  queryKey: ['categories-with-topics'],
  queryFn: async () => await categoriesService.findAll<true>({ include: 'topics' }),
})


const goSearch=()=>{
  router.push(`/learn/topics/search?page=1&limit=1&q=${search.value}`)
  search.value=''
}


const categories = computed<CategoryDetailResponse<true>[]>(() => {
  const res = categoryRes.value
  if (!res) return []
  if (Array.isArray(res.data)) return res.data
  const inner = res.data as { data?: unknown }
  if (inner && Array.isArray(inner.data)) return inner.data as CategoryDetailResponse<true>[]
  return []
})

const showTopics = ref<BaseTopic[]>([])

const handleCategoryHover = (categoryId: string) => {
  clearTimeout(hideTimeout || 0)
  isDropdownVisible.value = true
  selectCategory.value = categoryId
}

const showDropdown = () => {
  clearTimeout(hideTimeout || 0)
  isDropdownVisible.value = true
}

const scheduleHideDropdown = () => {
  hideTimeout = setTimeout(() => {
    isDropdownVisible.value = false
  }, 300)
}

const cancelHideDropdown = () => {
  clearTimeout(hideTimeout || 0)
}

const toggleMobileDropdown = () => {
  isMobileDropdownVisible.value = !isMobileDropdownVisible.value
}

const toggleCategory = (categoryId: string) => {
  if (selectCategory.value === categoryId) {
    selectCategory.value = ''
    showTopics.value = []
  } else {
    selectCategory.value = categoryId
    const category = categories.value.find(c => c.id === categoryId)
    showTopics.value = category?.topics ?? []
  }
}

watch(selectCategory, newVal => {
  const category = categories.value.find(c => c.id === newVal)
  showTopics.value = category?.topics ?? []
})

watch(categories, cats => {
  if (cats.length && !selectCategory.value) {
    selectCategory.value = cats[0]?.id ?? ''
    showTopics.value = cats[0]?.topics ?? []
  }
}, { immediate: true })

const selectedCategoryName = computed(
  () => categories.value.find(c => c.id === selectCategory.value)?.name ?? ''
)

const handleScroll = () => {
  isScrolling.value = window.scrollY > 0
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  document.body.style.overflow = ''
})

watch([isDropdownVisible, isMobileDropdownVisible], ([dropdown, mobile]) => {
  const shouldLock = dropdown || mobile
  document.body.style.overflow = shouldLock ? 'hidden' : ''
})

</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
