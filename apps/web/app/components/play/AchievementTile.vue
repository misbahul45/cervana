<script setup lang="ts">
import { computed } from 'vue';
import type { AchievementItem } from '~/interfaces/gamify';
import { achievementPercent } from '~/lib/gamify';
import { THEME_ICON_NAMES, type ThemeIconName } from '~/theme/icons';

const props = defineProps<{ item: AchievementItem }>();

const icon = computed<ThemeIconName>(() => ((THEME_ICON_NAMES as ReadonlyArray<string>).includes(props.item.iconName ?? '') ? (props.item.iconName as ThemeIconName) : 'badge'));
const percent = computed(() => achievementPercent(props.item.progress));
const date = computed(() => (props.item.unlockedAt ? new Date(props.item.unlockedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null));
</script>

<template>
  <PlayCard :tone="item.unlocked ? 'gold' : 'default'" class="rc-achievement" :class="!item.unlocked && 'rc-achievement--locked'" as="article">
    <div class="rc-achievement__icon">
      <GameIcon :name="icon" :size="56" :label="item.title" decorative />
      <GameIcon v-if="!item.unlocked" class="rc-achievement__lock" name="lock" :size="22" decorative />
    </div>
    <div class="rc-achievement__body">
      <h3 class="rc-achievement__title">{{ item.title }}</h3>
      <p v-if="item.description" class="rc-achievement__text">{{ item.description }}</p>
      <PlayProgress v-if="!item.unlocked" :value="percent" :label="`Kemajuan ${item.title}`" tone="info" />
      <p class="rc-achievement__meta">
        <template v-if="item.unlocked">{{ date ? `Diraih ${date}` : 'Sudah diraih' }}</template>
        <template v-else>{{ item.progress.value }} dari {{ item.progress.target }}</template>
      </p>
    </div>
  </PlayCard>
</template>

<style>
.rc-achievement {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.rc-achievement--locked .rc-achievement__icon img:first-child {
  filter: grayscale(1);
  opacity: 0.55;
}

.rc-achievement__icon {
  position: relative;
  flex: none;
}

.rc-achievement__lock {
  position: absolute;
  right: -0.25rem;
  bottom: -0.25rem;
}

.rc-achievement__body {
  display: grid;
  flex: 1;
  gap: 0.5rem;
  min-width: 0;
}

.rc-achievement__title {
  margin: 0;
  font-size: 1.0625rem;
}

.rc-achievement__text {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.9375rem;
}

.rc-achievement__meta {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 800;
}
</style>
