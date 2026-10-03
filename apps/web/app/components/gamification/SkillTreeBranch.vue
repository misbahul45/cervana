<script setup lang="ts">
defineProps<{
  level: { id: number; title: string; topics: Array<{ id: string; title: string }> };
  nodesByTopic: Record<string, { state: string; progress: number }>;
}>();
</script>

<template>
  <section :class="`skill-branch skill-branch--level-${level.id}`">
    <h2>{{ level.title }}</h2>
    <ul>
      <SkillTreeLeaf
        v-for="topic in level.topics"
        :key="topic.id"
        :topic="topic"
        :state="(nodesByTopic[topic.id]?.state as any)"
        :mastery="nodesByTopic[topic.id]?.progress"
      />
    </ul>
  </section>
</template>

<style scoped>
.skill-branch { border: 1px solid var(--rc-border, #d4d4d8); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.skill-branch ul { padding: 0; }
</style>