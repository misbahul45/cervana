<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { sandboxApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Latihan Jurnal — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Latihan Jurnal — ReduCera' });

const DIFFICULTY: Record<string, string> = { BEGINNER: 'Pemula', INTERMEDIATE: 'Menengah', ADVANCED: 'Mahir' };

const { data: scenarios, status, error, refresh } = useAsyncData('sandbox:scenarios', () => sandboxApi.listScenarios(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Latihan jurnal" subtitle="Catat transaksi dari skenario nyata. Sistem memeriksa keseimbangan debit dan kredit." />

    <LoadingSkeleton v-if="status === 'pending'" variant="card" :count="3" />
    <ErrorState v-else-if="error" title="Skenario gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="!scenarios || scenarios.length === 0"
      title="Belum ada skenario"
      message="Skenario latihan akan muncul setelah kamu mulai belajar."
      cta-label="Pilih topik"
      cta-to="/learn/topics"
    />
    <ul v-else class="rc-mgrid" aria-label="Skenario latihan">
      <li v-for="scenario in scenarios" :key="scenario.id">
        <article class="rc-card rc-mcard">
          <div class="rc-mcard__body">
            <p class="rc-mcard__meta">{{ DIFFICULTY[scenario.difficulty] ?? scenario.difficulty }} · Level {{ scenario.level }}</p>
            <h3 class="rc-mcard__title">
              <NuxtLink :to="`/sandbox/${scenario.id}`" class="rc-mcard__link">{{ scenario.title }}</NuxtLink>
            </h3>
            <p v-if="scenario.description" class="rc-mcard__summary">{{ scenario.description }}</p>
          </div>
        </article>
      </li>
    </ul>
  </div>
</template>
