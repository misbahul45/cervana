<script setup lang="ts">
import Header from './components/layout/Header.vue';
const route = useRoute()
</script>

<template>
  <UApp>
    <div class="app-wrapper cursor-rocket">
      <Header v-if="!route.path.startsWith('/my-learning')" />
      <NuxtPage />
    </div>
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
}
</style>
