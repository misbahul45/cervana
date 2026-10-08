<script setup lang="ts">
import { shellBindings } from '~/theme/shell';
import type { NormalizedTheme, ThemeVariantKey } from '~/theme/types';

const props = defineProps<{
  step?: NormalizedTheme | null;
  lesson?: NormalizedTheme | null;
  subTopic?: NormalizedTheme | null;
  topic?: NormalizedTheme | null;
  variant?: ThemeVariantKey;
}>();

const colorMode = useColorMode();

const bindings = computed(() =>
  shellBindings({
    chain: [props.step, props.lesson, props.subTopic, props.topic],
    variant: props.variant ?? 'LEARN',
    scheme: colorMode.value === 'dark' ? 'dark' : 'light',
    reducedMotion: false,
  }),
);
</script>

<template>
  <div v-bind="bindings.attrs" :style="bindings.style || undefined">
    <slot />
  </div>
</template>
