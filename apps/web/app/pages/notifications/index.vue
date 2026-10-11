<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed } from 'vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import type { User } from '~/interfaces/auth';
import type { NotificationDetailResponse } from '~/interfaces/notification';
import { canMarkRead, formatNotificationTime, notificationIcon, sortNotifications } from '~/lib/notifications';
import { QK } from '~/lib/query-keys';
import { notificationService } from '~/services/notifications';

definePageMeta({
  title: 'Notifikasi | ReduCera',
  protection: { kind: 'authenticated' },
});

const user = useState<User | null>('user');
const queryClient = useQueryClient();

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: QK.notifications(),
  queryFn: () => notificationService.findAll({ page: 1, limit: 50 }),
  staleTime: 30_000,
});

const items = computed(() => sortNotifications((data.value?.data ?? []) as NotificationDetailResponse[]));
const unreadMine = computed(() => items.value.filter((item) => canMarkRead(item, user.value?.id)));

const markRead = useMutation({
  mutationFn: (ids: string[]) =>
    Promise.all(ids.map((id) => notificationService.update(id, { readAt: new Date().toISOString() }))),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: QK.notifications() }),
});

useHead({ title: 'Notifikasi | ReduCera' });
</script>

<template>
  <div class="rc-stack rc-learning">
    <PageHeader title="Notifikasi" subtitle="Kabar tentang streak, pencapaian, dan pengumuman.">
      <template v-if="unreadMine.length" #actions>
        <PlayButton
          variant="outline"
          size="sm"
          :loading="markRead.isPending.value"
          @click="markRead.mutate(unreadMine.map((item) => item.id))"
        >
          Tandai semua dibaca
        </PlayButton>
      </template>
    </PageHeader>

    <div v-if="isLoading" class="rc-notif" aria-busy="true">
      <div v-for="n in 3" :key="n" class="rc-card"><span class="rc-skel rc-skel--line rc-skel--w80"></span></div>
    </div>

    <ErrorState v-else-if="isError" title="Notifikasi belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <EmptyState
      v-else-if="!items.length"
      icon-name="i-lucide-bell"
      title="Belum ada notifikasi"
      message="Kabar tentang streak dan pencapaianmu akan muncul di sini."
    />

    <ul v-else class="rc-notif">
      <li v-for="item in items" :key="item.id">
        <PlayCard class="rc-notif__item" :tone="item.readAt || item.isGlobal ? 'default' : 'info'">
          <GameIcon v-if="notificationIcon(item.type)" :name="notificationIcon(item.type)!" :size="36" decorative />
          <UIcon v-else name="i-lucide-bell" class="rc-notif__bell" aria-hidden="true" />
          <div class="rc-notif__text">
            <h2 class="rc-notif__title">{{ item.title }}</h2>
            <p v-if="item.body" class="rc-notif__body">{{ item.body }}</p>
            <p class="rc-hint">{{ formatNotificationTime(item.createdAt) }}</p>
          </div>
          <PlayButton
            v-if="canMarkRead(item, user?.id)"
            variant="ghost"
            size="sm"
            :disabled="markRead.isPending.value"
            @click="markRead.mutate([item.id])"
          >
            Tandai dibaca
          </PlayButton>
        </PlayCard>
      </li>
    </ul>
  </div>
</template>

<style>
.rc-notif {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-card.rc-notif__item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
}
.rc-notif__bell {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--rc-secondary);
}
.rc-notif__text {
  flex: 1;
  min-width: 0;
}
.rc-notif__title {
  margin: 0;
  font-size: 1.0625rem;
  overflow-wrap: anywhere;
}
.rc-notif__body {
  margin: 0.25rem 0 0.25rem;
  color: var(--rc-fg);
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .rc-card.rc-notif__item {
    flex-wrap: wrap;
  }
}
</style>
