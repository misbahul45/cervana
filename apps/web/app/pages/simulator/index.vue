<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { simulatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Simulator Perusahaan — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Simulator Perusahaan — ReduCera' });

const { data: scenarios, status, error, refresh } = useAsyncData('simulator:scenarios', () => simulatorApi.listScenarios(), { lazy: true });

const starting = ref<string | null>(null);
const problem = ref<string | null>(null);

async function pick(slug: string) {
  if (starting.value) return;
  starting.value = slug;
  problem.value = null;
  try {
    const company = await simulatorApi.create({ scenarioSlug: slug });
    if (company?.id) await navigateTo(`/simulator/${company.id}`);
  } catch (err) {
    problem.value = describeApiError(err, 'Simulasi gagal dimulai. Coba lagi.');
  } finally {
    starting.value = null;
  }
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Simulator perusahaan" subtitle="Kelola pembukuan perusahaan simulasi, lalu tutup periode dan baca laporannya." />

    <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>
    <LoadingSkeleton v-if="status === 'pending'" variant="card" :count="2" />
    <ErrorState v-else-if="error" title="Skenario gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState v-else-if="!scenarios || scenarios.length === 0" title="Belum ada skenario" message="Skenario simulator akan muncul di sini." />
    <ul v-else class="rc-studio-list" aria-label="Skenario simulator">
      <li v-for="scenario in scenarios" :key="scenario.slug" class="rc-card">
        <div class="rc-studio-list__main">
          <p class="rc-studio-list__title">{{ scenario.name }}</p>
          <p class="rc-hint">{{ scenario.days }} hari</p>
        </div>
        <PlayButton size="sm" :loading="starting === scenario.slug" @click="pick(scenario.slug)">Mulai simulasi</PlayButton>
      </li>
    </ul>
  </div>
</template>
