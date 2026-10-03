<script setup lang="ts">
import { simulatorApi } from '~/lib/api';

const scenarios = ref<{ slug: string; name: string; days: number }[]>([]);
try {
  scenarios.value = (await simulatorApi.listScenarios()) ?? [];
} catch {
  scenarios.value = [];
}

async function pick(slug: string) {
  const company = await simulatorApi.create({ scenarioSlug: slug });
  if (company?.id) await navigateTo(`/simulator/${company.id}`);
}

useHead({ title: 'Pilih Skenario Simulator — ReduCera' });
</script>

<template>
  <main>
    <h1>Pilih Skenario Simulator</h1>
    <ul>
      <li v-for="s in scenarios" :key="s.slug">
        <h2>{{ s.name }}</h2>
        <p>{{ s.days }} hari</p>
        <button @click="pick(s.slug)">Mulai simulasi</button>
      </li>
    </ul>
  </main>
</template>