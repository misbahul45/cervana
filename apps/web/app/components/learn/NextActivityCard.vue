<script setup lang="ts">
interface Props {
  title: string;
  reason?: string;
  estimatedMinutes?: number;
  topicName?: string;
  lessonId?: string;
}

const props = withDefaults(defineProps<Props>(), {});

function start() {
  if (!props.lessonId) return;
  navigateTo(`/my-learning/lessons/${props.lessonId}`);
}
</script>

<template>
  <article
    class="rc-next-activity-card"
    aria-labelledby="next-activity-title"
  >
    <header class="rc-next-activity-card__header">
      <p class="rc-next-activity-card__eyebrow">Aktivitas berikutnya</p>
      <h2 id="next-activity-title" class="rc-next-activity-card__title">
        {{ title }}
      </h2>
      <p v-if="reason" class="rc-next-activity-card__reason">{{ reason }}</p>
    </header>
    <dl class="rc-next-activity-card__meta">
      <div v-if="topicName">
        <dt>Topik</dt>
        <dd>{{ topicName }}</dd>
      </div>
      <div v-if="estimatedMinutes">
        <dt>Perkiraan waktu</dt>
        <dd>±{{ estimatedMinutes }} menit</dd>
      </div>
    </dl>
    <button
      type="button"
      class="rc-next-activity-card__cta"
      :disabled="!lessonId"
      @click="start"
    >
      Mulai aktivitas
    </button>
  </article>
</template>

<style scoped>
.rc-next-activity-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.04));
  border: 1px solid rgba(37, 99, 235, 0.15);
}
.rc-next-activity-card__eyebrow {
  font-size: 0.75rem;
  color: var(--ui-primary, #2563eb);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.rc-next-activity-card__title {
  font-size: 1.25rem;
  font-weight: 700;
}
.rc-next-activity-card__reason {
  color: var(--ui-text-muted);
  max-width: 36rem;
}
.rc-next-activity-card__meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin: 0;
}
.rc-next-activity-card__meta div {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.rc-next-activity-card__meta dt {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rc-next-activity-card__cta {
  align-self: flex-start;
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
.rc-next-activity-card__cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rc-next-activity-card__cta:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>