<script setup lang="ts">
import { computed } from 'vue';
import { authPitch } from '~/lib/auth-pitch';
import { LANDING_FACTS as F } from '~/lib/landing-facts';

const route = useRoute();
const pitch = computed(() => authPitch(route.path));

const stats = [
  { value: F.concepts, caption: 'konsep berprasyarat' },
  { value: F.achievements, caption: 'pencapaian awal' },
  { value: F.levels, caption: 'level dari XP' },
] as const;
</script>

<template>
  <div class="rc-showcase">
    <h2 class="rc-showcase__title">
      {{ pitch.lead }}
      <em>{{ pitch.accent }}</em>{{ pitch.tail }}
    </h2>
    <p class="rc-showcase__body">{{ pitch.body }}</p>

    <ul class="rc-showcase__cards">
      <li class="rc-showcase__card">
        <GameIcon name="streak" :size="40" decorative />
        <div>
          <strong>7 hari</strong>
          <span>streak dari penilaian</span>
        </div>
      </li>
      <li class="rc-showcase__card">
        <GameIcon name="xp" :size="40" decorative />
        <div>
          <strong>+{{ F.xpPerConceptPassed }} XP</strong>
          <span>konsep lulus</span>
        </div>
      </li>
      <li class="rc-showcase__card">
        <GameIcon name="star" :size="40" decorative />
        <div>
          <strong>1 bintang</strong>
          <span>satu bagian tuntas</span>
        </div>
      </li>
    </ul>

    <dl class="rc-showcase__stats">
      <div v-for="stat in stats" :key="stat.caption">
        <dt>{{ stat.value }}</dt>
        <dd>{{ stat.caption }}</dd>
      </div>
    </dl>

    <NuxtLink to="/#cara-kerja" class="rc-showcase__cta">Lihat cara kerjanya</NuxtLink>
  </div>
</template>
