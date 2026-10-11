<script setup lang="ts">
import { computed } from 'vue';
import { pathOffset, type PathNode, type PathNodeState } from '~/lib/learning-path';

const props = defineProps<{ nodes: ReadonlyArray<PathNode> }>();

const STATE_TEXT: Record<PathNodeState, string> = {
  done: 'Selesai',
  current: 'Lanjutkan di sini',
  available: 'Terbuka',
  locked: 'Terkunci, selesaikan bagian sebelumnya',
};

const items = computed(() =>
  props.nodes.map((node, index) => ({
    ...node,
    offset: pathOffset(index),
    icon: node.state === 'locked' ? ('lock' as const) : node.state === 'done' ? ('star' as const) : null,
    label: `${node.title}. ${STATE_TEXT[node.state]}`,
  })),
);
</script>

<template>
  <ol class="rc-path">
    <li
      v-for="item in items"
      :key="item.id"
      class="rc-path__item"
      :class="`rc-path__item--${item.state}`"
      :style="{ '--path-offset': item.offset }"
    >
      <span v-if="item.state === 'current'" class="rc-path__start">Mulai</span>

      <NuxtLink v-if="item.to" :to="item.to" class="rc-path__node" :aria-label="item.label">
        <GameIcon v-if="item.icon" :name="item.icon" :size="36" decorative />
        <UIcon v-else name="i-lucide-play" class="rc-path__play" aria-hidden="true" />
      </NuxtLink>
      <button v-else type="button" class="rc-path__node" disabled aria-disabled="true" :aria-label="item.label">
        <GameIcon :name="item.icon" :size="32" decorative />
      </button>

      <div class="rc-path__text">
        <h3 class="rc-path__title">{{ item.title }}</h3>
        <p v-if="item.summary" class="rc-path__summary">{{ item.summary }}</p>
        <p v-if="item.lessons" class="rc-hint">{{ item.lessons }} pelajaran</p>
      </div>
    </li>
  </ol>
</template>

<style>
.rc-path {
  --path-step: 2.5rem;
  display: grid;
  gap: 0;
  margin: 0 auto;
  padding: 0;
  max-width: 28rem;
  overflow-x: clip;
  list-style: none;
}
.rc-path__item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0 0.75rem;
  transform: translateX(calc(var(--path-offset, 0) * var(--path-step)));
}
.rc-path__item + .rc-path__item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  height: 1.5rem;
  border-left: 4px dotted var(--rc-border);
  transform: translateX(-50%);
}
.rc-path__start {
  padding: 0.25rem 0.875rem;
  border: 2px solid var(--rc-primary);
  border-radius: 12px;
  background-color: var(--rc-surface);
  color: var(--rc-primary);
  font-size: 0.8125rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.rc-path__node {
  --node-bg: var(--rc-info);
  --node-edge: var(--rc-secondary-depth);
  display: grid;
  place-items: center;
  width: 4.75rem;
  height: 4.75rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background-color: var(--node-bg);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--node-edge);
  cursor: pointer;
  transition: transform 90ms ease-out, box-shadow 90ms ease-out;
}
.rc-path__item--current .rc-path__node {
  --node-bg: var(--rc-primary);
  --node-edge: var(--rc-primary-depth);
  width: 5.5rem;
  height: 5.5rem;
  outline: 4px solid color-mix(in srgb, var(--rc-primary) 30%, transparent);
  outline-offset: 4px;
}
.rc-path__item--done .rc-path__node {
  --node-bg: var(--rc-gold);
  --node-edge: var(--rc-gold-depth);
}
.rc-path__item--locked .rc-path__node {
  --node-bg: var(--rc-border);
  --node-edge: var(--rc-border-strong);
  cursor: not-allowed;
  opacity: 0.85;
}
.rc-path__play {
  width: 2.25rem;
  height: 2.25rem;
  color: var(--rc-primary-fg);
  fill: currentColor;
}
.rc-path__item--available .rc-path__play {
  color: var(--rc-secondary-fg);
}
.rc-path__node:not(:disabled):active {
  transform: translateY(var(--rc-depth, 4px));
  box-shadow: none;
}
.rc-path__node:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 4px;
}
.rc-path__text {
  display: grid;
  gap: 0.125rem;
  max-width: 16rem;
  text-align: center;
}
.rc-path__title {
  margin: 0;
  font-size: 1.0625rem;
  overflow-wrap: anywhere;
}
.rc-path__summary {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}
.rc-path__item--locked .rc-path__title {
  color: var(--rc-muted);
}

@media (max-width: 480px) {
  .rc-path {
    --path-step: 1rem;
  }
  .rc-path__text {
    max-width: 13rem;
  }
}
</style>
