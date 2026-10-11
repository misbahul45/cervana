<script setup lang="ts">
import type { User } from '~/interfaces/auth';
import { useGamifyMe } from '~/composables/useGamify';
import { useHydrated } from '~/composables/useHydrated';
import { useLearning } from '~/stores/learning';

const user = useState<User | null>('user');
const learning = useLearning();
const hydrated = useHydrated();
const { data: me } = useGamifyMe();

const exitTo = computed(() =>
  hydrated.value && learning.topicSlug ? `/my-learning/topics/${learning.topicSlug}` : '/learn/profile/my-learning',
);
</script>

<template>
  <div class="rc-focus">
    <SkipLink />
    <header class="rc-focus__bar">
      <NuxtLink :to="exitTo" class="rc-focus__exit" aria-label="Keluar dari mode belajar">
        <UIcon name="i-lucide-x" aria-hidden="true" />
        <span>Keluar</span>
      </NuxtLink>
      <div v-if="user && hydrated && me" class="rc-focus__stats">
        <StatPill icon="streak" :value="me.streak.current" label="Streak" tone="flame" />
        <StatPill icon="xp" :value="me.xp" label="XP" tone="gold" />
      </div>
    </header>
    <main id="main" class="rc-focus__main">
      <slot />
    </main>
  </div>
</template>
