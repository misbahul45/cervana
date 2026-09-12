<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { ApiResponse } from '~/interfaces/api'
import { categoriesService } from '~/services/categories'
import type { BaseCategory, CategoriesListResponse } from '~/interfaces/categories'
import { toQueryString } from '~/lib/api'

const allCategories = ref<BaseCategory[]>([])
const limit = ref(10)
const type = ref<'popular' | 'all'>('popular')
const page = ref(1)
const adding = ref(false)

const fetchCategories = async (): Promise<ApiResponse<CategoriesListResponse>> => {
  return await categoriesService.findAll({
    page: page.value,
    limit: limit.value,
    type: type.value,
  })
}

const { data: categoryRes,isLoading, isError, refetch } = useQuery({
  queryKey: ['categories', type],
  queryFn: fetchCategories,
})

const totalPages = computed(() => categoryRes.value?.data?.pagination?.totalPages ?? 0)

watch(categoryRes, (res) => {
  if (!res?.data) return
  const newData = Array.isArray(res.data.data)
    ? res.data.data
    : Array.isArray(res.data)
    ? res.data
    : []
  if (adding.value) {
    allCategories.value = [...allCategories.value, ...newData]
    adding.value = false
  } else {
    allCategories.value = newData
  }
})

const addPage = async () => {
  adding.value = true
  page.value += 1
  await refetch()
}
</script>

<template>
  <div class="relative w-full">
    <div class="flex sm:gap-4 gap-2 py-2 items-center w-full overflow-x-auto no-scrollbar px-8 mask-horizontal">
      <template v-if="isLoading">
        <USkeleton
          v-for="n in 10"
          :key="'s-'+n"
          class="h-8 w-24 rounded-lg shrink-0"
        />
      </template>

      <template v-else>
        <div class="flex items-center gap-2 md:gap-4 md:text-base sm:text-sm text-[10px]">
          <UBadge variant="solid" class="text-nowrap">All Missions</UBadge>
          <UButton
            v-for="value in allCategories"
            :key="value.id"
            variant="outline"
            class="text-nowrap shrink-0 hover:scale-105 cursor-pointer transition-all"
            @click="$router.push(`/learn/topics/search?${toQueryString({ include:value.name })}`)"
          >
            {{ value.name }}
          </UButton>

          <USkeleton
            v-if="adding"
            v-for="n in 3"
            :key="'l-'+n"
            class="h-8 w-24 rounded-lg shrink-0"
          />
        </div>
      </template>

      <UButton
        v-if="
          allCategories.length > 0 &&
          allCategories.length % 10 === 0 &&
          page < totalPages
        "
        icon="i-lucide-arrow-right"
        variant="ghost"
        color="primary"
        class="ml-auto cursor-pointer"
        @click="addPage"
      >
        More
      </UButton>

      <div v-if="isError" class="text-sm text-red-500">
        Failed to load categories.
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask-horizontal {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    black 24px,
    black calc(100% - 24px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0,
    black 24px,
    black calc(100% - 24px),
    transparent 100%
  );
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
</style>
