<script setup lang="ts">
import { sandboxApi } from '~/lib/api';
import type { SandboxGraph } from '~/interfaces/sandbox';

const graph = ref<SandboxGraph>({ levels: [] });

try {
  graph.value = (await sandboxApi.graph()) as SandboxGraph;
} catch {
  graph.value = { levels: [] };
}

useHead({ title: 'Pohon Keterampilan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Pohon Keterampilan</h1>
    <p>Setiap level membuka topik baru. Selesaikan prasyarat untuk melanjutkan.</p>

    <div class="skill-tree">
      <LevelColumn v-for="level in graph.levels" :key="level.id" :level="level" />
    </div>
  </main>
</template>