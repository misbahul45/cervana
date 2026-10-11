<script setup lang="ts">
import { computed } from 'vue';
import type { BoardEntry } from '~/interfaces/gamify';
import { formatCount, medalFor } from '~/lib/gamify';

const props = defineProps<{ entry: BoardEntry; unit?: string }>();

const medal = computed(() => medalFor(props.entry.rank));
</script>

<template>
  <li class="rc-rank" :class="entry.you && 'rc-rank--you'" :aria-current="entry.you ? 'true' : undefined">
    <span class="rc-rank__place" :class="medal && `rc-rank__place--${medal}`">{{ entry.rank }}</span>
    <span class="rc-rank__handle">@{{ entry.handle }}<span v-if="entry.you" class="rc-chip rc-chip--info rc-rank__you">Kamu</span></span>
    <span class="rc-rank__score">{{ formatCount(entry.score) }} <span class="rc-rank__unit">{{ unit ?? 'konsep' }}</span></span>
  </li>
</template>

<style>
.rc-rank {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  list-style: none;
}

.rc-rank--you {
  border-color: var(--rc-info);
  background-color: color-mix(in srgb, var(--rc-info) 10%, var(--rc-surface));
}

.rc-rank__place {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  background-color: var(--rc-foam);
  color: var(--rc-muted);
  font-weight: 900;
}

.rc-rank__place--gold {
  background-color: var(--rc-gold);
  color: #2b2000;
}

.rc-rank__place--silver {
  background-color: #cfd5d9;
  color: #22292d;
}

.rc-rank__place--bronze {
  background-color: #e0a672;
  color: #2c1704;
}

.rc-rank__handle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rc-rank__you {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
}

.rc-rank__score {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.rc-rank__unit {
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}
</style>
