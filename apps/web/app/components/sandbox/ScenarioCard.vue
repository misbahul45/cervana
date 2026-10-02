<script setup lang="ts">
import type { SandboxScenario } from '~/interfaces/sandbox';

defineProps<{ scenario: SandboxScenario }>();
</script>

<template>
  <li class="scenario-card">
    <NuxtLink :to="`/sandbox/${scenario.id}`">
      <h2>{{ scenario.title }}</h2>
      <p class="meta">
        Level {{ scenario.level }} ·
        <span :class="`difficulty difficulty--${scenario.difficulty.toLowerCase()}`">
          {{ scenario.difficulty }}
        </span>
      </p>
      <p class="description">{{ scenario.description }}</p>
    </NuxtLink>
  </li>
</template>

<style scoped>
.scenario-card {
  border: 1px solid var(--rc-border, #d4d4d8);
  border-radius: 8px;
  padding: 1rem;
  list-style: none;
}
.scenario-card a {
  color: inherit;
  text-decoration: none;
}
.difficulty--beginner { color: #16a34a; }
.difficulty--intermediate { color: #ca8a04; }
.difficulty--advanced { color: #b91c1c; }
</style>