<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedMinutes?: number;
  prerequisiteLabel?: string;
  learningObjective?: string;
  to?: string;
}

defineProps<Props>();
</script>

<template>
  <NuxtLink :to="to || '#'" class="rc-sandbox-card">
    <h3 class="rc-sandbox-card__title">{{ title }}</h3>
    <p v-if="description" class="rc-sandbox-card__description">{{ description }}</p>
    <dl class="rc-sandbox-card__meta">
      <div v-if="difficulty">
        <dt>Kesulitan</dt>
        <dd>{{ difficulty.toLowerCase() }}</dd>
      </div>
      <div v-if="estimatedMinutes">
        <dt>Perkiraan waktu</dt>
        <dd>±{{ estimatedMinutes }} menit</dd>
      </div>
      <div v-if="prerequisiteLabel">
        <dt>Prasyarat</dt>
        <dd>{{ prerequisiteLabel }}</dd>
      </div>
    </dl>
    <p v-if="learningObjective" class="rc-sandbox-card__objective">
      <strong>Tujuan:</strong> {{ learningObjective }}
    </p>
  </NuxtLink>
</template>

<style scoped>
.rc-sandbox-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.75rem;
  background: var(--ui-bg, white);
  color: var(--ui-text);
  text-decoration: none;
}
.rc-sandbox-card:hover {
  border-color: #d97706;
}
.rc-sandbox-card__title { font-size: 1rem; font-weight: 600; }
.rc-sandbox-card__description {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-sandbox-card__meta {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
}
.rc-sandbox-card__meta div {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-sandbox-card__meta dt {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rc-sandbox-card__meta dd { margin: 0; color: var(--ui-text); }
.rc-sandbox-card__objective { font-size: 0.875rem; color: var(--ui-text); }
</style>