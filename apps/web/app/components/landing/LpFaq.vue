<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
</script>

<template>
  <LpSection id="faq" :title="C.faq.title">
    <div class="lp-faq">
      <details v-for="item in C.faq.items" :key="item.q" class="lp-faq__item">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </div>
  </LpSection>
</template>
