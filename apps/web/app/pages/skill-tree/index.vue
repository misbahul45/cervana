<script setup lang="ts">
import { computed } from 'vue';
import { sandboxApi } from '~/lib/api';
import { personalizationApi } from '~/lib/api';
import type { SkillNodeRecord, SandboxGraph } from '~/interfaces/sandbox';

const graph = ref<SandboxGraph>({ levels: [] });
const skillNodes = ref<SkillNodeRecord[]>([]);

try {
  graph.value = (await sandboxApi.graph()) as SandboxGraph;
  skillNodes.value = (await personalizationApi.listSkillNodes()) as SkillNodeRecord[];
} catch {
  graph.value = { levels: [] };
}

const nodesByTopic = computed(() => {
  const map: Record<string, { state: string; progress: number }> = {};
  for (const n of skillNodes.value) map[n.topicId] = { state: n.state, progress: n.progress };
  return map;
});

useHead({ title: 'Pohon Keterampilan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Pohon Keterampilan</h1>
    <p>Setiap level membuka topik baru. Selesaikan prasyarat untuk melanjutkan.</p>
    <div class="skill-tree">
      <SkillTreeBranch v-for="level in graph.levels" :key="level.id" :level="level" :nodes-by-topic="nodesByTopic" />
    </div>
  </main>
</template>