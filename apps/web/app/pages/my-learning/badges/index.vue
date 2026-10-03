<script setup lang="ts">
import { gamificationApi } from '~/lib/api';
import type { LevelInfo, UserAchievement } from '~/interfaces/sandbox';

const badges = ref<UserAchievement[]>([]);
const level = ref<LevelInfo | null>(null);

try {
  badges.value = (await gamificationApi.listBadges()) as UserAchievement[];
  level.value = (await gamificationApi.level()) as LevelInfo | null;
} catch {
  badges.value = [];
  level.value = null;
}

useHead({ title: 'Badge & Level — ReduCera' });
</script>

<template>
  <main>
    <h1>Badge & Level</h1>
    <LevelBadge v-if="level" :level="level.level" :xp="level.xp" />
    <section>
      <h2>Badge</h2>
      <BadgeGrid :items="badges" />
      <p v-if="badges.length === 0">Belum ada badge.</p>
    </section>
  </main>
</template>