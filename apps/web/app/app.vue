<script setup lang="ts">
import Header from './components/layout/Header.vue';
import ThemeShell from './components/theme/ThemeShell.vue';
const route = useRoute()
</script>

<template>
  <UApp>
    <ThemeShell class="app-wrapper">
      <Header v-if="!route.path.startsWith('/my-learning')" />
      <NuxtPage />
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
