<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';
import { shellRender } from '~/theme/shell';
import type { DefaultThemePayload } from '~/theme/default-payload';
import type { NormalizedTheme, ThemeVariantKey } from '~/theme/types';

const props = defineProps<{
  step?: NormalizedTheme | null;
  lesson?: NormalizedTheme | null;
  subTopic?: NormalizedTheme | null;
  topic?: NormalizedTheme | null;
  variant?: ThemeVariantKey;
}>();

const defaultTheme = useState<DefaultThemePayload | null>('rc-default-theme', () => null);
const motionPreference = usePreferredReducedMotion();
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});

const render = computed(() =>
  shellRender({
    chain: [props.step, props.lesson, props.subTopic, props.topic, defaultTheme.value?.theme],
    variant: props.variant ?? 'LEARN',
    reducedMotion: mounted.value && motionPreference.value === 'reduce',
  }),
);

useHead(
  computed(() => ({
    style: render.value.darkCss ? [{ key: 'rc-dark-theme', innerHTML: render.value.darkCss }] : [],
  })),
);
</script>

<template>
  <div v-bind="render.attrs" :style="render.style || undefined">
    <slot />
  </div>
</template>
