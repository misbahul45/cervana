<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { User } from '~/interfaces/auth';
import { useAchievements, useGamifyMe } from '~/composables/useGamify';
import { achievementPercent, formatCount, streakCopy } from '~/lib/gamify';
import { personalizationApi } from '~/lib/api';
import { nextConceptCopy } from '~/lib/learner';
import { TONE_COLOR, masteryTone, toPercent } from '~/lib/mastery';

definePageMeta({ title: 'Beranda — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Beranda — ReduCera' });

const user = useState<User | null>('user');
const { data: me, isLoading, isError, refetch } = useGamifyMe();
const { data: achievements } = useAchievements();
const enabled = computed(() => Boolean(user.value));
const { data: next } = useQuery({ queryKey: ['learner', 'next-concept'], queryFn: () => personalizationApi.nextConcept(), enabled, staleTime: 30_000 });
const { data: mastery } = useQuery({ queryKey: ['learner', 'mastery-list'], queryFn: () => personalizationApi.listMastery(), enabled, staleTime: 30_000 });

const firstName = computed(() => (user.value?.name ?? '').split(' ')[0] || 'Pembelajar');
const nextCopy = computed(() => (next.value ? nextConceptCopy(next.value) : null));
const streakInfo = computed(() => (me.value ? streakCopy(me.value.streak.status) : null));
const topMastery = computed(() => [...(mastery.value ?? [])].sort((a, b) => b.score - a.score).slice(0, 4));
const closest = computed(() =>
  (achievements.value?.achievements ?? [])
    .filter((a) => !a.unlocked)
    .sort((a, b) => achievementPercent(b.progress) - achievementPercent(a.progress))[0],
);
</script>

<template>
  <div>
    <PageHeader :title="`Halo, ${firstName}`" subtitle="Lanjutkan dari tempatmu berhenti. Setiap penilaian menambah bukti penguasaanmu." />

    <LoadingSkeleton v-if="isLoading" variant="panel" :count="2" aria-label="Memuat beranda" />
    <ErrorState v-else-if="isError || !me" title="Beranda belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <div v-else class="rc-home">
      <PlayCard tone="success" as="section" class="rc-home__next" aria-labelledby="next-title">
        <h2 id="next-title" class="rc-home__next-title">{{ nextCopy?.title ?? 'Mulai belajar' }}</h2>
        <p class="rc-hint">{{ nextCopy?.reason ?? 'Pilih topik pertamamu dan kumpulkan bukti belajar.' }}</p>
        <div class="rc-row" style="margin-top: 1rem">
          <PlayButton to="/learn/topics" size="lg">{{ nextCopy?.done ? 'Jelajahi topik lain' : 'Lanjut belajar' }}</PlayButton>
          <PlayButton to="/sandbox" variant="outline" size="lg">Latihan di sandbox</PlayButton>
        </div>
      </PlayCard>

      <PlayCard as="section" class="rc-home__streak" aria-labelledby="streak-title">
        <div class="rc-row" style="justify-content: space-between; flex-wrap: nowrap">
          <h2 id="streak-title" class="rc-h2" style="margin: 0">Streak {{ formatCount(me.streak.current) }} hari</h2>
          <GameIcon name="streak" :size="40" decorative />
        </div>
        <p class="rc-hint">{{ streakInfo?.hint }}</p>
        <StreakWeek :week="me.streak.week" style="margin-top: 0.75rem" />
        <PlayButton to="/learn/streaks" variant="ghost" size="sm" style="margin-top: 0.5rem">Detail streak</PlayButton>
      </PlayCard>

      <PlayCard as="section" class="rc-home__level" aria-labelledby="level-title">
        <h2 id="level-title" class="rc-h2">Level {{ me.level.level }}</h2>
        <div class="rc-row" style="flex-wrap: nowrap">
          <LevelRing :level="me.level.level" :progress="me.level.progress" :size="88" />
          <p class="rc-hint" style="margin: 0">
            <strong>{{ formatCount(me.xp) }} XP</strong><br />
            <template v-if="me.level.toNext !== null">{{ formatCount(me.level.toNext) }} XP lagi ke level {{ me.level.level + 1 }}</template>
            <template v-else>Level tertinggi</template>
          </p>
        </div>
      </PlayCard>

      <PlayCard as="section" class="rc-home__mastery" aria-labelledby="mastery-title">
        <div class="rc-row" style="justify-content: space-between">
          <h2 id="mastery-title" class="rc-h2" style="margin: 0">Penguasaan konsep</h2>
          <PlayButton to="/my-learning/mastery" variant="ghost" size="sm">Semua</PlayButton>
        </div>
        <p v-if="topMastery.length === 0" class="rc-hint" style="margin-top: 0.75rem">Belum ada konsep dengan bukti. Selesaikan satu penilaian untuk memulai.</p>
        <ul v-else class="rc-home__bars">
          <li v-for="entry in topMastery" :key="entry.conceptId">
            <div class="rc-row" style="justify-content: space-between; flex-wrap: nowrap"><span>{{ entry.title }}</span><strong>{{ toPercent(entry.score) }}%</strong></div>
            <div class="rc-progress" role="progressbar" :aria-label="`Penguasaan ${entry.title}`" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="toPercent(entry.score)">
              <div class="rc-progress__fill" :style="{ width: `${toPercent(entry.score)}%`, backgroundColor: TONE_COLOR[masteryTone(entry)] }" />
            </div>
          </li>
        </ul>
      </PlayCard>

      <PlayCard v-if="closest" as="section" tone="gold" class="rc-home__achievement" aria-labelledby="ach-title">
        <h2 id="ach-title" class="rc-h2" style="margin-bottom: 0.25rem">{{ closest.title }}</h2>
        <p class="rc-hint">{{ closest.description }}</p>
        <PlayProgress :value="achievementPercent(closest.progress)" :label="`Kemajuan ${closest.title}`" tone="gold" show-value />
      </PlayCard>
    </div>
  </div>
</template>

<style>
.rc-home {
  display: grid;
  gap: 1.25rem;
}

.rc-home__next-title {
  margin: 0.25rem 0 0.5rem;
  font-size: clamp(1.5rem, 4vw, 2rem);
}

.rc-home__bars {
  display: grid;
  gap: 0.875rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .rc-home {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rc-home__next,
  .rc-home__mastery {
    grid-column: 1 / -1;
  }
}
</style>
