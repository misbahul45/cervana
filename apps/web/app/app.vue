<script setup lang="ts">
import { computed } from 'vue';
import ThemeShell from './components/theme/ThemeShell.vue';
import { fallbackLayout } from '~/lib/nav';

const route = useRoute();
const user = useState('user');
const layoutName = computed(() => fallbackLayout(route.path, route.meta.layout as string | undefined, Boolean(user.value)));
</script>

<template>
  <UApp>
    <ThemeShell class="app-wrapper">
      <NuxtLayout :name="layoutName">
        <NuxtPage />
      </NuxtLayout>
    </ThemeShell>
  </UApp>
</template>

<style>
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.app-wrapper {
  min-height: 100vh;
  background-color: var(--rc-bg);
  color: var(--rc-fg);
}
</style>
