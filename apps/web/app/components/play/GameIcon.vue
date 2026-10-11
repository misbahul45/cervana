<script setup lang="ts">
import { computed } from 'vue';
import { iconAlt, type ThemeIconName, type ThemeIconSet } from '~/theme/icons';

const props = withDefaults(
  defineProps<{
    name: ThemeIconName;
    size?: number;
    label?: string;
    decorative?: boolean;
    preferred?: ReadonlyArray<ThemeIconSet>;
  }>(),
  { size: 24, label: undefined, decorative: false, preferred: () => [] },
);

const { urlFor } = useGameIcons();
const src = computed(() => urlFor(props.name, props.preferred));
const alt = computed(() => iconAlt(props.name, { label: props.label, decorative: props.decorative }));
</script>

<template>
  <img class="rc-game-icon" :src="src" :alt="alt" :width="size" :height="size" decoding="async" :data-icon="name" />
</template>

<style>
.rc-game-icon {
  display: inline-block;
  flex: none;
  object-fit: contain;
  vertical-align: middle;
}
</style>
