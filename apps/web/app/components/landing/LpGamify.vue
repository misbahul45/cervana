<script setup lang="ts">
import { ref } from 'vue';
import { LANDING_COPY as C } from '~/lib/landing-copy';
import type { ThemeIconName } from '~/theme/icons';

const active = ref(0);
const features = C.gamify.features;
</script>

<template>
  <LpSection id="gamifikasi" :title="C.gamify.title" :lead="C.gamify.lead">
    <div class="lp-tabs" role="tablist" aria-label="Mekanisme gamifikasi">
      <button
        v-for="(feature, i) in features"
        :key="feature.title"
        :id="`lp-tab-${i}`"
        type="button"
        role="tab"
        class="lp-tab"
        :aria-selected="active === i"
        :aria-controls="`lp-panel-${i}`"
        :tabindex="active === i ? 0 : -1"
        @click="active = i"
      >
        <GameIcon :name="feature.icon as ThemeIconName" :size="28" decorative />
        <span>{{ feature.title }}</span>
      </button>
    </div>
    <div v-for="(feature, i) in features" v-show="active === i" :id="`lp-panel-${i}`" :key="feature.title" class="lp-panel" role="tabpanel" :aria-labelledby="`lp-tab-${i}`">
      <GameIcon :name="feature.icon as ThemeIconName" :size="112" decorative />
      <div>
        <h3 class="lp-panel__title">{{ feature.title }}</h3>
        <p class="lp-panel__body">{{ feature.body }}</p>
      </div>
    </div>
  </LpSection>
</template>
