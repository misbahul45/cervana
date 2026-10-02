<script setup lang="ts">
import { sandboxApi } from '~/lib/api';
import type { SandboxScenario } from '~/interfaces/sandbox';

const scenarios = ref<SandboxScenario[]>([]);

try {
  scenarios.value = (await sandboxApi.listScenarios()) as SandboxScenario[];
} catch {
  scenarios.value = [];
}

useHead({ title: 'Sandbox Latihan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Sandbox Akuntansi</h1>
    <p>Latih pencatatan jurnal Anda di skenario dunia nyata.</p>

    <ul class="scenario-grid">
      <SandboxScenarioCard
        v-for="scenario in scenarios"
        :key="scenario.id"
        :scenario="scenario"
      />
    </ul>
  </main>
</template>