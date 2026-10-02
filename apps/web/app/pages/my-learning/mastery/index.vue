<script setup lang="ts">
import { personalizationApi } from '~/lib/api';
import type { MasteryScore, MisconceptionPattern, NextActivityDecision } from '~/interfaces/sandbox';

const [mastery, misconceptions, next] = await Promise.all([
  personalizationApi.listMastery().catch(() => [] as MasteryScore[]),
  personalizationApi.listMisconceptions().catch(() => [] as MisconceptionPattern[]),
  personalizationApi.nextActivity().catch(() => null as NextActivityDecision | null),
]);

useHead({ title: 'Profil Belajar Saya — ReduCera' });
</script>

<template>
  <main>
    <h1>Profil Belajar</h1>

    <section class="mastery">
      <h2>Penguasaan per Topik</h2>
      <MasteryProgressBar v-for="m in mastery" :key="m.topicId" :mastery="m" />
      <p v-if="mastery.length === 0">Belum ada data penguasaan. Mulai dari latihan.</p>
    </section>

    <section class="misconceptions">
      <h2>Miskonsepsi Aktif</h2>
      <MisconceptionList :items="misconceptions" />
    </section>

    <section class="next">
      <h2>Aktivitas Berikutnya</h2>
      <NextActivityCard :decision="next" />
    </section>
  </main>
</template>