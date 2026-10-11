<script setup lang="ts">
import { computed } from 'vue';
import { useGamifyMe } from '~/composables/useGamify';
import { formatCount, streakCopy } from '~/lib/gamify';

definePageMeta({ title: 'Streak — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Streak — ReduCera' });

const { data: me, isLoading, isError, refetch } = useGamifyMe();
const copy = computed(() => (me.value ? streakCopy(me.value.streak.status) : null));
const cardTone = computed(() => {
  const tone = copy.value?.tone;
  return tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : tone === 'info' ? 'info' : tone === 'warning' ? 'gold' : 'default';
});
</script>

<template>
  <div>
    <PageHeader title="Streak" subtitle="Hari berturut-turut kamu menyelesaikan penilaian dengan bukti belajar. Login atau mengobrol tidak menambah streak." />

    <LoadingSkeleton v-if="isLoading" variant="panel" :count="2" aria-label="Memuat streak" />
    <ErrorState v-else-if="isError || !me" title="Streak belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <div v-else class="rc-stack" style="--rc-stack-gap: 1.25rem">
      <PlayCard :tone="cardTone" as="section" aria-labelledby="streak-now">
        <div class="rc-streak-hero">
          <GameIcon name="streak" :size="96" label="Streak" />
          <div>
            <p class="rc-streak-hero__count" id="streak-now"><span>{{ formatCount(me.streak.current) }}</span> hari</p>
            <p class="rc-streak-hero__title">{{ copy?.title }}</p>
            <p class="rc-hint">{{ copy?.hint }}</p>
          </div>
        </div>
        <StreakWeek :week="me.streak.week" class="rc-streak-week" />
        <div class="rc-row rc-streak-actions">
          <PlayButton to="/learn/topics" variant="primary">Lanjut belajar</PlayButton>
          <PlayButton to="/learn/achievements" variant="outline">Lihat pencapaian</PlayButton>
        </div>
      </PlayCard>

      <div class="rc-grid">
        <PlayCard as="section">
          <h2 class="rc-h2">Rekor terpanjang</h2>
          <p class="rc-bignum">{{ formatCount(me.streak.longest) }} <span>hari</span></p>
          <p class="rc-hint">Rekor tetap tersimpan walau streak putus.</p>
        </PlayCard>
        <PlayCard as="section">
          <h2 class="rc-h2">Pembeku streak</h2>
          <p class="rc-bignum rc-row" style="flex-wrap: nowrap"><GameIcon name="freeze" :size="40" decorative /> {{ me.streak.freezes }} <span>dari 2</span></p>
          <p class="rc-hint">Satu pembeku diperoleh setiap 7 hari beruntun dan dipakai otomatis saat satu hari terlewat.</p>
        </PlayCard>
      </div>

      <PlayCard tone="soft" as="section">
        <h2 class="rc-h2">Cara streak bekerja</h2>
        <ul class="rc-list">
          <li>Satu hari dihitung bila kamu menyelesaikan sedikitnya satu penilaian yang menghasilkan bukti belajar.</li>
          <li>Hari mengikuti zona waktu akunmu, bukan zona waktu server.</li>
          <li>Satu penilaian atau seratus penilaian dalam sehari sama-sama dihitung satu hari.</li>
          <li>Setiap kelipatan 7 hari kamu mendapat bonus XP dan, bila belum penuh, satu pembeku streak.</li>
          <li>Pesan chat, login, dan membuka halaman tidak pernah menambah streak.</li>
        </ul>
      </PlayCard>
    </div>
  </div>
</template>

<style>
.rc-streak-hero {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.rc-streak-hero__count {
  margin: 0;
  color: var(--rc-accent);
  font-size: 1.25rem;
  font-weight: 800;
}

.rc-streak-hero__count span {
  font-size: clamp(2.5rem, 8vw, 3.75rem);
  font-weight: 900;
  line-height: 1;
}

.rc-streak-hero__title {
  margin: 0.25rem 0 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.rc-streak-week {
  margin-bottom: 1.25rem;
}

.rc-streak-actions {
  margin-top: 0.5rem;
}




</style>
