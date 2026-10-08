<script setup lang="ts">
type NodeStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';

interface SkillNode {
  id: string;
  title: string;
  status: NodeStatus;
  prerequisiteIds: string[];
  masteryLevel?: number;
}

interface Props {
  nodes: SkillNode[];
}

const props = defineProps<Props>();

const byId = computed(() => Object.fromEntries(props.nodes.map(n => [n.id, n])));

function statusFor(node: SkillNode): NodeStatus {
  if (node.status === 'MASTERED') return 'MASTERED';
  const prereqsMet = node.prerequisiteIds.every(pid => {
    const p = byId.value[pid];
    return p?.status === 'MASTERED';
  });
  if (!prereqsMet) return 'LOCKED';
  return node.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'AVAILABLE';
}

function lockedReason(node: SkillNode): string {
  const missing = node.prerequisiteIds.filter(pid => {
    const p = byId.value[pid];
    return !p || p.status !== 'MASTERED';
  }).map(pid => byId.value[pid]?.title || pid);
  return `Selesaikan ${missing.join(', ')} dulu`;
}
</script>

<template>
  <ol class="rc-skill-tree-graph" aria-label="Peta keterampilan">
    <li
      v-for="node in nodes"
      :key="node.id"
      :class="['rc-skill-tree-graph__node', `rc-skill-tree-graph__node--${statusFor(node)}`]"
    >
      <article :aria-label="`${node.title} — ${statusFor(node)}`">
        <h3 class="rc-skill-tree-graph__title">{{ node.title }}</h3>
        <p class="rc-skill-tree-graph__status">
          <StatusBadge :tone="statusFor(node) === 'MASTERED' ? 'success' : statusFor(node) === 'IN_PROGRESS' ? 'info' : statusFor(node) === 'AVAILABLE' ? 'warning' : 'neutral'">
            {{ statusFor(node) }}
          </StatusBadge>
        </p>
        <p
          v-if="statusFor(node) === 'LOCKED'"
          class="rc-skill-tree-graph__locked"
        >
          {{ lockedReason(node) }}
        </p>
        <MasteryMeter
          v-if="node.masteryLevel !== undefined && statusFor(node) !== 'LOCKED'"
          :level="node.masteryLevel"
          :max-level="100"
        />
      </article>
    </li>
  </ol>
</template>

<style scoped>
.rc-skill-tree-graph {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .rc-skill-tree-graph {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .rc-skill-tree-graph {
    grid-template-columns: repeat(3, 1fr);
  }
}
.rc-skill-tree-graph__node {
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.75rem;
  background: var(--ui-bg, white);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rc-skill-tree-graph__node--LOCKED        { opacity: 0.55; }
.rc-skill-tree-graph__node--MASTERED     { border-color: #16a34a; }
.rc-skill-tree-graph__node--IN_PROGRESS   { border-color: #2563eb; }
.rc-skill-tree-graph__node--AVAILABLE     { border-color: #f59e0b; }
.rc-skill-tree-graph__title { font-size: 1rem; font-weight: 600; }
.rc-skill-tree-graph__locked {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>