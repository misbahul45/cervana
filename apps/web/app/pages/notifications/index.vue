<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Notifikasi — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const { data: notifications, isLoading } = useQuery({
  queryKey: QK.notifications(),
  queryFn: async () => [
    { id: 'n-1', kind: 'lesson.graded' as const, body: 'Pelajaran Jurnal Umum telah dinilai. Skor: 85%', at: '2026-10-04T10:00:00Z', read: false },
    { id: 'n-2', kind: 'mastery.milestone' as const, body: 'Anda menguasai konsep Double-Entry.', at: '2026-10-03T15:00:00Z', read: true },
    { id: 'n-3', kind: 'order.paid' as const, body: 'Pembayaran pesanan #o-2 diterima.', at: '2026-10-02T09:00:00Z', read: false },
  ],
  staleTime: 30_000,
});

function markAllRead() {
  if (!notifications.value) return;
  for (const n of notifications.value) n.read = true;
}
</script>

<template>
  <main id="main" aria-labelledby="notif-h">
    <PreviewNotice />
    <header class="rc-notif__head">
      <h1 id="notif-h">Notifikasi</h1>
      <button type="button" @click="markAllRead">Tandai semua dibaca</button>
    </header>

    <LoadingSkeleton v-if="isLoading" variant="row" :count="3" />
    <ul v-else-if="notifications && notifications.length" class="rc-notif__list">
      <li
        v-for="n in notifications"
        :key="n.id"
        :class="['rc-notif__item', n.read ? 'rc-notif__item--read' : 'rc-notif__item--unread']"
      >
        <p>{{ n.body }}</p>
        <span>{{ new Date(n.at).toLocaleString('id-ID') }}</span>
        <span v-if="!n.read" class="rc-notif__unread-dot" aria-label="Belum dibaca" />
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-notif__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.rc-notif__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-notif__item {
  position: relative;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
}
.rc-notif__item--unread { border-color: var(--ui-primary, #2563eb); }
.rc-notif__item span {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-notif__unread-dot {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--ui-primary, #2563eb);
}
</style>