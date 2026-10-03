<script setup lang="ts">
import { computed, ref } from 'vue';
import { simulatorApi } from '~/lib/api';

const route = useRoute();
const companyId = computed(() => String(route.params.companyId));
const period = ref(new Date().toISOString().slice(0, 7));
const statements = ref<any | null>(null);
const refreshing = ref(false);

async function refresh() {
  refreshing.value = true;
  try {
    statements.value = (await simulatorApi.statements(companyId.value, period.value)) as any;
  } catch (e) {
    statements.value = null;
  } finally {
    refreshing.value = false;
  }
}

async function close() {
  await simulatorApi.closePeriod(companyId.value, period.value);
  await refresh();
}

useHead({ title: () => `Laporan Simulasi ${period.value} — ReduCera` });
</script>

<template>
  <main>
    <h1>Laporan Simulasi</h1>
    <input v-model="period" type="month" />
    <button :disabled="refreshing" @click="refresh">Hitung ulang</button>
    <button @click="close">Tutup periode</button>

    <section v-if="statements">
      <StatementPanel title="Laba Rugi" :data="statements.incomeStatement" />
      <StatementPanel title="Neraca" :data="statements.balanceSheet" />
      <StatementPanel title="Arus Kas" :data="statements.cashFlow" />
      <p>Snapshot hash: <code>{{ statements.snapshotHash }}</code></p>
    </section>
    <NuxtLink :to="`/simulator/${companyId.value}/journal`">Buka jurnal</NuxtLink>
  </main>
</template>