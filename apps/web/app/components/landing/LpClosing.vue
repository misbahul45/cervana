<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
</script>

<template>
  <section class="lp-closing" aria-labelledby="closing-title">
    <div class="lp-container lp-closing__inner">
      <h2 id="closing-title" class="lp-closing__title">{{ C.closing.title }}</h2>
      <p class="lp-closing__sub">{{ C.closing.sub }}</p>
      <div class="lp-hero__actions" style="justify-content: center">
        <NuxtLink to="/register" class="lp-btn">{{ C.closing.primary }}</NuxtLink>
        <NuxtLink to="/login" class="lp-link lp-link--arrow">{{ C.closing.secondary }}</NuxtLink>
      </div>
    </div>
  </section>
</template>
