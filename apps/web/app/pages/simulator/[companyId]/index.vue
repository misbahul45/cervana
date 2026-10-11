<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import { simulatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Laporan Simulasi — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const route = useRoute();
const companyId = computed(() => String(route.params.companyId));
const period = ref(new Date().toISOString().slice(0, 7));
const statements = ref<any | null>(null);
const working = ref(false);
const problem = ref<string | null>(null);

async function refresh() {
  working.value = true;
  problem.value = null;
  try {
    statements.value = (await simulatorApi.statements(companyId.value, period.value)) as any;
  } catch (err) {
    statements.value = null;
    problem.value = describeApiError(err, 'Laporan gagal dihitung. Coba lagi.');
  } finally {
    working.value = false;
  }
}

async function close() {
  working.value = true;
  problem.value = null;
  try {
    await simulatorApi.closePeriod(companyId.value, period.value);
  } catch (err) {
    problem.value = describeApiError(err, 'Periode gagal ditutup. Coba lagi.');
    working.value = false;
    return;
  }
  working.value = false;
  await refresh();
}

useHead({ title: () => `Laporan Simulasi ${period.value} — ReduCera` });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Laporan simulasi" subtitle="Hitung laporan periode, lalu tutup periode bila pembukuan sudah selesai.">
      <template #actions>
        <PlayButton :to="`/simulator/${companyId}/journal`" variant="secondary" size="sm">Buka jurnal</PlayButton>
      </template>
    </PageHeader>

    <div class="rc-toolbar">
      <label>
        Periode
        <input v-model="period" type="month" class="rc-field" />
      </label>
      <PlayButton size="sm" :loading="working" @click="refresh">Hitung ulang</PlayButton>
      <PlayButton size="sm" variant="secondary" :disabled="working" @click="close">Tutup periode</PlayButton>
    </div>

    <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>

    <template v-if="statements">
      <SimulatorStatementPanel title="Laba rugi" :data="statements.incomeStatement" />
      <SimulatorStatementPanel title="Neraca" :data="statements.balanceSheet" />
      <SimulatorStatementPanel title="Arus kas" :data="statements.cashFlow" />
      <p class="rc-hint">Sidik snapshot: <code>{{ statements.snapshotHash }}</code></p>
    </template>
    <p v-else class="rc-hint">Tekan Hitung ulang untuk melihat laporan periode ini.</p>
  </div>
</template>
