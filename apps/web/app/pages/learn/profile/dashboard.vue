<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Beranda Learner — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const me = useState('user');

const { data: nextActivity, isLoading: nextLoading, error: nextError } = useQuery({
  queryKey: QK.learner.nextActivity(),
  queryFn: async () => {
    return {
      title: 'Lanjutkan: Jurnal Umum untuk Transaksi Tunai',
      reason: 'Konsep jurnal umum adalah dasar dari double-entry. Kamu sudah menguasai 60%.',
      topicName: 'Pencatatan Akuntansi Dasar',
      estimatedMinutes: 15,
      lessonId: 'lesson-jurnal-umum-01',
    };
  },
  staleTime: 60_000,
});

const { data: mastery, isLoading: masteryLoading } = useQuery({
  queryKey: QK.learner.mastery(),
  queryFn: async () => ({ level: 62, targetLevel: 80, maxLevel: 100 }),
  staleTime: 5 * 60_000,
});

const { data: streak } = useQuery({
  queryKey: QK.learner.streak(),
  queryFn: async () => ({ count: 4 }),
  staleTime: 60_000,
});

const { data: progress } = useQuery({
  queryKey: QK.learner.progress(),
  queryFn: async () => ({
    masteredCount: 7,
    inProgressCount: 2,
    pendingCount: 4,
  }),
  staleTime: 60_000,
});
</script>

<template>
  <main id="main" aria-labelledby="dashboard-heading">
    <PreviewNotice />
    <header class="rc-dashboard__header">
      <h1 id="dashboard-heading">Di mana posisimu?</h1>
      <p class="rc-dashboard__intro">
        Halo, {{ me?.name || 'learner' }}. Berikut peta aktivitasmu hari ini.
      </p>
    </header>

    <section
      class="rc-dashboard__grid"
      aria-label="Ringkasan progres"
    >
      <article class="rc-dashboard__card rc-dashboard__card--next">
        <LoadingSkeleton v-if="nextLoading" variant="card" />
        <ErrorState
          v-else-if="nextError"
          title="Gagal memuat aktivitas berikutnya"
          message="Coba lagi silakan hubungi dukungan jika terus berulang."
        />
        <NextActivityCard
          v-else-if="nextActivity"
          :title="nextActivity.title"
          :reason="nextActivity.reason"
          :topic-name="nextActivity.topicName"
          :estimated-minutes="nextActivity.estimatedMinutes"
          :lesson-id="nextActivity.lessonId"
        />
      </article>

      <article class="rc-dashboard__card rc-dashboard__card--progress">
        <h2 class="rc-dashboard__card-title">Progres konsep</h2>
        <LoadingSkeleton v-if="masteryLoading" variant="panel" :count="2" />
        <template v-else>
          <MasteryMeter
            :level="mastery?.level ?? 0"
            :target-level="mastery?.targetLevel ?? 100"
            :max-level="mastery?.maxLevel ?? 100"
            label="Penguasaan akuntansi dasar"
          />
        </template>
        <ul
          v-if="progress"
          class="rc-dashboard__progress-summary"
          aria-label="Ringkasan progres"
        >
          <li><strong>{{ progress.masteredCount }}</strong> dikuasai</li>
          <li><strong>{{ progress.inProgressCount }}</strong> sedang dipelajari</li>
          <li><strong>{{ progress.pendingCount }}</strong> menunggu</li>
        </ul>
      </article>

      <article class="rc-dashboard__card rc-dashboard__card--streak">
        <h2 class="rc-dashboard__card-title">Streak</h2>
        <StreakIndicator v-if="streak" :count="streak.count" />
      </article>
    </section>

    <section class="rc-dashboard__quick-actions" aria-label="Aksi cepat">
      <NuxtLink to="/learn/path" class="rc-dashboard__quick-action">
        <UIcon name="i-lucide-git-branch" class="text-2xl" aria-hidden="true" />
        <span>Peta Keterampilan</span>
      </NuxtLink>
      <NuxtLink to="/sandbox" class="rc-dashboard__quick-action">
        <UIcon name="i-lucide-flask-conical" class="text-2xl" aria-hidden="true" />
        <span>Sandbox Akuntansi</span>
      </NuxtLink>
      <NuxtLink to="/credits" class="rc-dashboard__quick-action">
        <UIcon name="i-lucide-wallet" class="text-2xl" aria-hidden="true" />
        <span>Kredit AI</span>
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.rc-dashboard__header {
  margin-bottom: 1.5rem;
}
.rc-dashboard__intro {
  color: var(--ui-text-muted);
  margin-top: 0.25rem;
}
.rc-dashboard__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  margin-bottom: 1.5rem;
}
@media (min-width: 768px) {
  .rc-dashboard__grid {
    grid-template-columns: 2fr 1fr;
  }
  .rc-dashboard__card--streak { grid-column: 1 / -1; }
}
.rc-dashboard__card {
  padding: 1.25rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 1rem;
  background: var(--ui-bg, white);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.rc-dashboard__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rc-dashboard__progress-summary {
  list-style: none;
  display: flex;
  gap: 1rem;
  margin: 0;
  padding: 0;
}
.rc-dashboard__progress-summary li {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-dashboard__progress-summary strong {
  display: block;
  color: var(--ui-text);
  font-size: 1.125rem;
  font-weight: 700;
}
.rc-dashboard__quick-actions {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, 1fr);
}
.rc-dashboard__quick-action {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
}
.rc-dashboard__quick-action:hover {
  background: var(--ui-bg-muted, #f3f4f6);
}
</style>