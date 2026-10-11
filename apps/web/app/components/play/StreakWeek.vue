<script setup lang="ts">
import type { CalendarDay } from '~/interfaces/gamify';
import { weekdayShort } from '~/lib/gamify';
import { dayStateLabel } from '~/lib/play';

defineProps<{ week: CalendarDay[] }>();
</script>

<template>
  <ol class="rc-week" aria-label="Streak tujuh hari terakhir">
    <li v-for="day in week" :key="day.date" class="rc-week__day" :class="`rc-week__day--${day.state}`" :aria-label="`${weekdayShort(day.date)}, ${day.date}: ${dayStateLabel(day.state)}`">
      <span class="rc-week__name">{{ weekdayShort(day.date) }}</span>
      <span class="rc-week__dot">
        <GameIcon v-if="day.state === 'done'" name="streak" :size="22" decorative />
        <GameIcon v-else-if="day.state === 'frozen'" name="freeze" :size="22" decorative />
        <UIcon v-else-if="day.state === 'today'" name="i-lucide-circle-dot" class="rc-week__today" aria-hidden="true" />
      </span>
    </li>
  </ol>
</template>

<style>
.rc-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rc-week__day {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.rc-week__name {
  color: var(--rc-muted);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rc-week__dot {
  display: grid;
  place-items: center;
  width: min(2.5rem, 100%);
  aspect-ratio: 1;
  border: 2px solid var(--rc-border);
  border-radius: 999px;
  background-color: var(--rc-foam);
}

.rc-week__day--done .rc-week__dot {
  border-color: var(--rc-flame);
  background-color: color-mix(in srgb, var(--rc-flame) 14%, var(--rc-surface));
}

.rc-week__day--frozen .rc-week__dot {
  border-color: var(--rc-info);
  background-color: color-mix(in srgb, var(--rc-info) 14%, var(--rc-surface));
}

.rc-week__day--today .rc-week__dot {
  border-color: var(--rc-focus);
  background-color: var(--rc-surface);
}

.rc-week__today {
  color: var(--rc-focus);
  width: 1.25rem;
  height: 1.25rem;
}
</style>
