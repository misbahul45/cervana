<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
</script>

<template>
  <LpSection id="bukti" :title="C.proof.title">
    <dl class="lp-proof">
      <div v-for="item in C.proof.items" :key="item.label" class="lp-proof__item">
        <dt class="lp-proof__value">{{ item.value }}</dt>
        <dd class="lp-proof__label">{{ item.label }}</dd>
      </div>
    </dl>
  </LpSection>
</template>
