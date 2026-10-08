<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Peta Keterampilan — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const { data: nodes, isLoading, error } = useQuery({
  queryKey: QK.curriculum.skillTree(),
  queryFn: async () => ([
    { id: 'accounting-equation', title: 'Persamaan Akuntansi', status: 'MASTERED' as const, prerequisiteIds: [], masteryLevel: 100 },
    { id: 'double-entry', title: 'Double-Entry', status: 'MASTERED' as const, prerequisiteIds: ['accounting-equation'], masteryLevel: 100 },
    { id: 'normal-balance', title: 'Normal Balance', status: 'IN_PROGRESS' as const, prerequisiteIds: ['double-entry'], masteryLevel: 70 },
    { id: 'contra-account', title: 'Contra Account', status: 'AVAILABLE' as const, prerequisiteIds: ['normal-balance'] },
    { id: 'journal-entry', title: 'Jurnal Umum', status: 'AVAILABLE' as const, prerequisiteIds: ['double-entry', 'normal-balance'] },
    { id: 'trial-balance', title: 'Neraca Saldo', status: 'LOCKED' as const, prerequisiteIds: ['journal-entry'] },
    { id: 'adjusting-entries', title: 'Ayat Penyesuaian', status: 'LOCKED' as const, prerequisiteIds: ['trial-balance'] },
  ]),
  staleTime: 5 * 60_000,
});
</script>

<template>
  <main id="main" aria-labelledby="skill-tree-heading">
    <PreviewNotice />
    <header class="rc-skill-tree__header">
      <h1 id="skill-tree-heading">Peta Keterampilan</h1>
      <p>Node yang terkunci akan menampilkan prasyarat yang harus diselesaikan lebih dulu.</p>
    </header>

    <LoadingSkeleton v-if="isLoading" variant="panel" :count="4" />
    <ErrorState
      v-else-if="error"
      title="Gagal memuat peta keterampilan"
    />
    <SkillTreeGraph v-else-if="nodes" :nodes="nodes" />
  </main>
</template>

<style scoped>
.rc-skill-tree__header { margin-bottom: 1rem; }
.rc-skill-tree__header p { color: var(--ui-text-muted); }
.rc-skill-tree__header h1 { font-size: 1.5rem; font-weight: 700; }
</style>