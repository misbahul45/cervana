<script setup lang="ts">
import { computed } from 'vue';
import { sandboxApi } from '~/lib/api';
import type { SandboxScenario } from '~/interfaces/sandbox';

const route = useRoute();
const scenarioId = computed(() => String(route.params.scenarioId));

const scenarios = ref<SandboxScenario[]>([]);
try {
  scenarios.value = (await sandboxApi.listScenarios()) as SandboxScenario[];
} catch {
  scenarios.value = [];
}

const scenario = computed(() => scenarios.value.find((s) => s.id === scenarioId.value));

useHead({
  title: () => `${scenario.value?.title ?? 'Skenario'} — ReduCera`,
});
</script>

<template>
  <main v-if="scenario">
    <h1>{{ scenario.title }}</h1>
    <p>{{ scenario.description }}</p>
    <p>Level {{ scenario.level }} · {{ scenario.difficulty }}</p>

    <JournalEntryForm :scenario-id="scenario.id" />
  </main>
  <main v-else>
    <h1>Skenario tidak ditemukan</h1>
    <NuxtLink to="/sandbox">Kembali ke daftar</NuxtLink>
  </main>
</template>