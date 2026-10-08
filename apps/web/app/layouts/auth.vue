<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <div class="rc-auth-layout">
    <SkipLink />
    <header class="rc-auth-layout__header">
      <BrandLogo label="Kembali ke beranda" />
    </header>
    <main id="main" class="rc-auth-layout__main">
      <slot />
    </main>
    <footer class="rc-auth-layout__footer">
      <NuxtLink to="/">Kembali ke beranda</NuxtLink>
    </footer>
  </div>
</template>

<style scoped>
.rc-auth-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
.rc-auth-layout__header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-auth-layout__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.rc-auth-layout__main {
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.rc-auth-layout__footer {
  padding: 1rem;
  text-align: center;
}
</style>