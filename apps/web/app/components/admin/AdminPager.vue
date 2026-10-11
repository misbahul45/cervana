<script setup lang="ts">
import { pageWindow } from '~/lib/admin';

const props = defineProps<{ page: number; totalPages: number; total: number; label?: string }>();
const emit = defineEmits<{ change: [page: number] }>();

const pages = computed(() => pageWindow(props.page, props.totalPages));

function go(target: number) {
  if (target >= 1 && target <= props.totalPages && target !== props.page) emit('change', target);
}
</script>

<template>
  <nav v-if="totalPages > 1" class="rc-pager" :aria-label="label ?? 'Halaman'">
    <p class="rc-hint">{{ total }} data · halaman {{ page }} dari {{ totalPages }}</p>
    <div class="rc-pager__pages">
      <button type="button" class="rc-pager__page" :disabled="page <= 1" aria-label="Halaman sebelumnya" @click="go(page - 1)">
        <UIcon name="i-lucide-chevron-left" aria-hidden="true" />
      </button>
      <template v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === '…'" class="rc-pager__gap" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="rc-pager__page"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`Halaman ${item}`"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </template>
      <button type="button" class="rc-pager__page" :disabled="page >= totalPages" aria-label="Halaman berikutnya" @click="go(page + 1)">
        <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
      </button>
    </div>
  </nav>
  <p v-else-if="total > 0" class="rc-hint rc-pager">{{ total }} data</p>
</template>
