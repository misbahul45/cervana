<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayProgress from '~/components/play/PlayProgress.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { personalizationApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { summarizeMastery, toPercent } from '~/lib/mastery';

definePageMeta({
  title: 'Penguasaan — ReduCera',
  protection: { kind: 'authenticated' },
});

useHead({ title: 'Penguasaan — ReduCera' });

const { data: mastery, status, error, refresh } = useAsyncData('learner:mastery', () => personalizationApi.listMastery(), { lazy: true });

const summary = computed(() => summarizeMastery(mastery.value ?? []));
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Penguasaan" subtitle="Seberapa jauh kamu menguasai tiap konsep, dihitung dari hasil kuis dan latihan." />

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error" title="Penguasaan gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <ul class="rc-studio-stats" aria-label="Ringkasan penguasaan">
        <li class="rc-card"><span class="rc-hint">Konsep dikerjakan</span><strong>{{ summary.conceptsStarted }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Rata-rata penguasaan</span><strong>{{ summary.averagePercent }}%</strong></li>
        <li class="rc-card"><span class="rc-hint">Konsep dikuasai</span><strong>{{ summary.masteredCount }}</strong></li>
      </ul>

      <section class="rc-stack" aria-labelledby="mastery-detail">
        <h2 id="mastery-detail" class="rc-h2">Detail penguasaan</h2>
        <EmptyState
          v-if="!mastery || mastery.length === 0"
          title="Belum ada data penguasaan"
          message="Kerjakan kuis pertamamu untuk melihat kemajuan di sini."
          cta-label="Pilih topik"
          cta-to="/learn/topics"
        />
        <ul v-else class="rc-studio-list" aria-label="Penguasaan per konsep">
          <li v-for="entry in mastery.slice(0, 30)" :key="entry.conceptId" class="rc-card rc-mastery__row">
            <p class="rc-studio-list__title">{{ entry.title }}</p>
            <PlayProgress :value="toPercent(entry.score)" :label="entry.title" :tone="entry.mastered ? 'success' : 'info'" show-value />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
