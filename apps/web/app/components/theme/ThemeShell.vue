<script setup lang="ts">
import { useResolvedTheme } from '~/composables/useResolvedTheme';

const props = defineProps<{
  step?: { slug: string; title: string; version: number } | null;
  lesson?: { slug: string; title: string; version: number } | null;
  subTopic?: { slug: string; title: string; version: number } | null;
  topic?: { slug: string; title: string; version: number } | null;
  variant?: 'LEARN' | 'PRACTICE' | 'CHALLENGE' | 'EXAM';
}>();

const { resolved, style, dataAttributes } = useResolvedTheme({
  step: props.step as never,
  lesson: props.lesson as never,
  subTopic: props.subTopic as never,
  topic: props.topic as never,
  variant: props.variant,
});
</script>

<template>
  <div v-bind="dataAttributes" :style="style">
    <slot :resolved="resolved" />
  </div>
</template>

