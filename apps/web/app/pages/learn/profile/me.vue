<script setup lang="ts">
import { computed } from 'vue';
import type { User } from '~/interfaces/auth';
import { useAchievements, useGamifyMe } from '~/composables/useGamify';
import { formatCount } from '~/lib/gamify';

definePageMeta({ title: 'Profil — ReduCera', protection: { kind: 'authenticated' } });
useHead({ title: 'Profil — ReduCera' });

const user = useState<User | null>('user');
const { data: me, isLoading, isError, refetch } = useGamifyMe();
const { data: achievements } = useAchievements();
const recent = computed(() => (achievements.value?.achievements ?? []).filter((a) => a.unlocked).slice(-3).reverse());
</script>

<template>
  <div>
    <PageHeader :title="user?.name ?? 'Profilku'" subtitle="Ringkasan kemajuanmu. Semua angka dihitung dari bukti belajar yang tercatat.">
      <template #actions>
        <PlayButton to="/learn/profile/settings" variant="outline" size="sm">Pengaturan</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="isLoading" variant="panel" :count="2" aria-label="Memuat profil" />
    <ErrorState v-else-if="isError || !me" title="Profil belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <div v-else class="rc-stack" style="--rc-stack-gap: 1.25rem">
      <PlayCard as="section" aria-labelledby="level-title">
        <div class="rc-me-level">
          <LevelRing :level="me.level.level" :progress="me.level.progress" :size="112" />
          <div>
            <h2 id="level-title" class="rc-h2" style="margin-bottom: 0.25rem">Level {{ me.level.level }}</h2>
            <p class="rc-bignum" style="margin: 0">{{ formatCount(me.xp) }} <span>XP</span></p>
            <p class="rc-hint" style="margin-top: 0.25rem">
              <template v-if="me.level.toNext !== null">{{ formatCount(me.level.toNext) }} XP lagi menuju level {{ me.level.level + 1 }}.</template>
              <template v-else>Kamu di level tertinggi saat ini.</template>
            </p>
          </div>
        </div>
      </PlayCard>

      <div class="rc-grid">
        <PlayCard as="section"><h2 class="rc-h2">Streak</h2><p class="rc-bignum rc-row" style="flex-wrap: nowrap"><GameIcon name="streak" :size="40" decorative /> {{ formatCount(me.streak.current) }} <span>hari</span></p></PlayCard>
        <PlayCard as="section"><h2 class="rc-h2">Bintang</h2><p class="rc-bignum rc-row" style="flex-wrap: nowrap"><GameIcon name="star" :size="40" decorative /> {{ formatCount(me.stars) }}</p></PlayCard>
        <PlayCard as="section"><h2 class="rc-h2">Rekor streak</h2><p class="rc-bignum rc-row" style="flex-wrap: nowrap"><GameIcon name="trophy" :size="40" decorative /> {{ formatCount(me.streak.longest) }} <span>hari</span></p></PlayCard>
      </div>

      <section aria-labelledby="recent-title">
        <div class="rc-row" style="justify-content: space-between; margin-bottom: 0.75rem">
          <h2 id="recent-title" class="rc-h2" style="margin: 0">Pencapaian terbaru</h2>
          <PlayButton to="/learn/achievements" variant="ghost" size="sm">Lihat semua</PlayButton>
        </div>
        <EmptyState v-if="recent.length === 0" title="Belum ada pencapaian" message="Selesaikan penilaian pertamamu untuk membuka pencapaian." icon-name="i-lucide-badge-check" cta-label="Mulai belajar" cta-to="/learn/topics" />
        <div v-else class="rc-grid rc-grid--wide">
          <AchievementTile v-for="item in recent" :key="item.code" :item="item" />
        </div>
      </section>
    </div>
  </div>
</template>

<style>
.rc-me-level {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}
</style>
