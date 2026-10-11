<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import type { User } from '~/interfaces/auth';
import { useTopicBoard } from '~/composables/useGamify';
import { formatCount } from '~/lib/gamify';
import { userTopicService } from '~/services/learning/userTopic';

definePageMeta({ title: 'Peringkat — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Peringkat — ReduCera' });

const user = useState<User | null>('user');
const { data: topics, isLoading: topicsLoading } = useQuery({
  queryKey: ['gamify', 'board-topics', computed(() => user.value?.id ?? '')],
  enabled: computed(() => Boolean(user.value?.id)),
  queryFn: async () => {
    const res = await userTopicService.findAll<true>({ page: 1, limit: 50, userId: user.value?.id, include: 'topic' });
    const list = res.data?.data ?? [];
    return list.flatMap((row) => (row.topic ? [{ id: row.topicId, title: row.topic.title }] : []));
  },
});

const selected = ref<string | null>(null);
watch(
  topics,
  (list) => {
    if (!selected.value && list && list.length > 0) selected.value = list[0]!.id;
  },
  { immediate: true },
);

const { data: board, isLoading: boardLoading, isError, refetch } = useTopicBoard(selected);
</script>

<template>
  <div>
    <PageHeader title="Peringkat" subtitle="Papan per topik, dihitung dari konsep yang pertama kali kamu lulus minggu ini. Hanya yang ikut serta yang tampil, dengan nama panggilan." />

    <BoardMembershipForm class="rc-board-join" />

    <LoadingSkeleton v-if="topicsLoading" variant="row" :count="3" aria-label="Memuat topik" />
    <EmptyState
      v-else-if="!topics || topics.length === 0"
      title="Belum ada topik"
      message="Daftar ke sebuah topik untuk melihat peringkatnya."
      icon-name="i-lucide-book-open"
      cta-label="Jelajahi topik"
      cta-to="/learn/topics"
    />
    <section v-else class="rc-stack" style="--rc-stack-gap: 1rem" aria-label="Papan topik">
      <div class="rc-row">
        <label class="rc-label" for="board-topic">Topik</label>
        <select id="board-topic" v-model="selected" class="rc-field rc-board-select">
          <option v-for="topic in topics" :key="topic.id" :value="topic.id">{{ topic.title }}</option>
        </select>
      </div>

      <LoadingSkeleton v-if="boardLoading" variant="row" :count="4" aria-label="Memuat peringkat" />
      <ErrorState v-else-if="isError || !board" title="Peringkat belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />
      <template v-else>
        <p class="rc-hint">
          Minggu {{ board.window.startDate }}.
          <template v-if="board.me.optedIn && board.me.rank">Kamu di peringkat {{ board.me.rank }} dengan {{ formatCount(board.me.score) }} konsep.</template>
          <template v-else-if="board.me.score > 0">Kamu sudah lulus {{ formatCount(board.me.score) }} konsep minggu ini. Ikut serta agar namamu tampil.</template>
          <template v-else>Lulus satu konsep minggu ini untuk masuk papan.</template>
        </p>
        <EmptyState v-if="board.entries.length === 0" title="Papan masih kosong" message="Belum ada yang lulus konsep di topik ini minggu ini. Jadilah yang pertama." icon-name="i-lucide-trophy" />
        <ol v-else class="rc-rank-list">
          <RankRow v-for="entry in board.entries" :key="entry.handle" :entry="entry" />
        </ol>
      </template>
    </section>
  </div>
</template>

<style>
.rc-board-join {
  margin-bottom: 1.5rem;
}

.rc-board-select {
  width: auto;
  min-width: 14rem;
}

.rc-rank-list {
  display: grid;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
}
</style>
