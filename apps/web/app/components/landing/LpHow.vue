<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
import { LANDING_FACTS as F } from '~/lib/landing-facts';

const rule = `{
  "code": "CONCEPT_PASSED",
  "version": 1,
  "eventType": "ASSESSMENT_COMPLETED",
  "rewardKind": "XP",
  "amount": ${F.xpPerConceptPassed},
  "active": true
}`;

const ledger = `ruleId        CONCEPT_PASSED
ruleVersion   1
kind          XP
points        ${F.xpPerConceptPassed}
idempotencyKey reward:CONCEPT_PASSED:v1:<learner>:<concept>
append-only   ya (tidak bisa diubah)`;
</script>

<template>
  <LpSection id="cara-kerja" :title="C.how.title" :lead="C.how.lead">
    <ol class="lp-steps">
      <li v-for="step in C.how.steps" :key="step.title" class="lp-card">
        <h3 class="lp-card__title">{{ step.title }}</h3>
        <p class="lp-card__body">{{ step.body }}</p>
      </li>
    </ol>
    <div class="lp-code-grid">
      <figure class="lp-code">
        <pre :aria-label="C.how.ruleLabel"><code>{{ rule }}</code></pre>
      </figure>
      <figure class="lp-code">
        <pre :aria-label="C.how.ledgerLabel"><code>{{ ledger }}</code></pre>
      </figure>
    </div>
  </LpSection>
</template>
