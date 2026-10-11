<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';

definePageMeta({ layout: 'landing', protection: { kind: 'public' } });

useHead({
  title: C.meta.title,
  meta: [
    { name: 'description', content: C.meta.description },
    { property: 'og:title', content: C.meta.title },
    { property: 'og:description', content: C.meta.description },
  ],
});
</script>

<template>
  <div>
    <a href="#main" class="lp-skip">Lewati ke konten</a>
    <LpHeader />
    <main id="main">
      <LpHero />
      <LpProblem />
      <LpHow />
      <LpGamify />
      <LpTheme />
      <LpProof />
      <LpFaq />
      <LpClosing />
    </main>
    <LpFooter />
  </div>
</template>
