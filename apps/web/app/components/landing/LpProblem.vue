<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
</script>

<template>
  <LpSection id="masalah" :title="C.problem.title" :lead="C.problem.lead">
    <div class="lp-cards">
      <article v-for="card in C.problem.cards" :key="card.title" class="lp-card lp-card--split">
        <div>
          <h3 class="lp-card__title">{{ card.title }}</h3>
          <p class="lp-card__body">{{ card.body }}</p>
          <p class="lp-card__rule"><span aria-hidden="true">✓</span> {{ card.rule }}</p>
        </div>
        <svg class="lp-card__art" viewBox="0 0 120 120" aria-hidden="true">
          <rect x="30" y="30" width="60" height="60" rx="14" fill="none" stroke="#ff6b6b" stroke-width="2.5" />
          <path d="M45 45 75 75M75 45 45 75" stroke="#ff6b6b" stroke-width="3.5" stroke-linecap="round" />
        </svg>
      </article>
    </div>
  </LpSection>
</template>
