<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAchievements } from '~/composables/useGamify';

type Filter = 'all' | 'unlocked' | 'locked';

const { data, isLoading, isError, refetch } = useAchievements();
const filter = ref<Filter>('all');

const filters: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'unlocked', label: 'Diraih' },
  { id: 'locked', label: 'Belum' },
];

const visible = computed(() => {
  const list = data.value?.achievements ?? [];
  return filter.value === 'all' ? list : list.filter((item) => (filter.value === 'unlocked' ? item.unlocked : !item.unlocked));
});
</script>

<template>
  <div>
    <PageHeader
      title="Pencapaian"
      :subtitle="data ? `${data.unlocked} dari ${data.total} pencapaian diraih. Aturannya tersimpan di database dan dihitung dari bukti belajar.` : 'Pencapaian diraih dari bukti belajar, bukan dari klik.'"
    />

    <LoadingSkeleton v-if="isLoading" variant="card" :count="4" aria-label="Memuat pencapaian" />
    <ErrorState v-else-if="isError || !data" title="Pencapaian belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <template v-else>
      <div class="rc-row rc-filter" role="group" aria-label="Saring pencapaian">
        <button
          v-for="item in filters"
          :key="item.id"
          type="button"
          class="rc-chip rc-filter__chip"
          :class="filter === item.id && 'rc-chip--info'"
          :aria-pressed="filter === item.id"
          @click="filter = item.id"
        >
          {{ item.label }}
        </button>
      </div>

      <EmptyState v-if="visible.length === 0" title="Belum ada yang cocok" message="Selesaikan penilaian untuk membuka pencapaian berikutnya." icon-name="i-lucide-badge-check" cta-label="Mulai belajar" cta-to="/learn/topics" />
      <div v-else class="rc-grid rc-grid--wide">
        <AchievementTile v-for="item in visible" :key="item.code" :item="item" />
      </div>
    </template>
  </div>
</template>

<style>
.rc-filter {
  margin-bottom: 1.25rem;
}

.rc-filter__chip {
  min-height: 2.5rem;
  padding: 0.375rem 1rem;
  cursor: pointer;
  font-family: inherit;
}

.rc-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
}
</style>
