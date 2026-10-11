<script setup lang="ts">
import { computed, ref } from 'vue';
import oceanJson from '~/theme/reducera-ocean.theme.json';
import playJson from '~/theme/reducera-play.theme.json';
import { LANDING_COPY as C } from '~/lib/landing-copy';
import { normalizeTheme } from '~/theme/normalize';
import { THEME_ICON_NAMES } from '~/theme/icons';

const themes = { play: normalizeTheme(playJson)!, ocean: normalizeTheme(oceanJson)! };
const current = ref<'play' | 'ocean'>('play');
const tokens = computed(() => themes[current.value].tokens.light);
const shape = computed(() => themes[current.value].shape ?? { radius: 8, depth: 0 });
const demoStyle = computed(() => ({
  '--demo-bg': tokens.value.bg,
  '--demo-surface': tokens.value.surface,
  '--demo-fg': tokens.value.fg,
  '--demo-muted': tokens.value.muted,
  '--demo-border': tokens.value.border,
  '--demo-primary': tokens.value.primary,
  '--demo-primary-fg': tokens.value.primaryFg,
  '--demo-depth-color': tokens.value.primaryDepth ?? tokens.value.primary,
  '--demo-radius': `${shape.value.radius}px`,
  '--demo-depth': `${shape.value.depth}px`,
}));
</script>

<template>
  <LpSection id="tema" :title="C.theme.title" :lead="C.theme.lead">
    <div class="lp-theme">
      <div class="lp-theme__switch" role="group" aria-label="Pilih tema contoh">
        <button v-for="option in C.theme.options" :key="option.id" type="button" class="lp-chip" :aria-pressed="current === option.id" @click="current = option.id as 'play' | 'ocean'">
          {{ option.label }}
        </button>
        <p class="lp-theme__note">{{ C.theme.options.find((o) => o.id === current)?.note }}</p>
      </div>
      <div class="lp-theme__demo" :style="demoStyle" :data-theme="current">
        <p class="lp-theme__demo-title">Selesaikan satu penilaian hari ini</p>
        <div class="lp-theme__icons">
          <GameIcon v-for="name in THEME_ICON_NAMES.slice(0, 6)" :key="name" :name="name" :size="34" decorative />
        </div>
        <span class="lp-theme__demo-button">Lanjut belajar</span>
      </div>
    </div>
  </LpSection>
</template>
