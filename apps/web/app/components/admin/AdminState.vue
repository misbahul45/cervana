<script setup lang="ts">
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { describeApiError } from '~/lib/api-error';

withDefaults(
  defineProps<{
    status: string;
    error?: unknown;
    empty?: boolean;
    errorTitle?: string;
    emptyTitle?: string;
    emptyMessage?: string;
    skeleton?: number;
  }>(),
  { error: null, empty: false, errorTitle: 'Data gagal dimuat', emptyTitle: 'Belum ada data', emptyMessage: '', skeleton: 4 },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <LoadingSkeleton v-if="status === 'pending' || status === 'idle'" variant="row" :count="skeleton" />
  <ErrorState v-else-if="error" :title="errorTitle" :message="describeApiError(error)" @retry="emit('retry')" />
  <EmptyState v-else-if="empty" :title="emptyTitle" :message="emptyMessage" />
  <slot v-else />
</template>
