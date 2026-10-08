<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <div class="rc-public-layout">
    <header class="rc-public-layout__header">
      <BrandLogo tagline label="ReduCera - beranda" />
      <nav class="rc-public-layout__nav" aria-label="Navigasi utama">
        <NuxtLink to="/marketplace">Marketplace</NuxtLink>
        <NuxtLink to="/creators">Kreator</NuxtLink>
        <NuxtLink to="/become-creator">Jadi Kreator</NuxtLink>
        <NuxtLink to="/login" class="rc-btn rc-btn--sm">Masuk</NuxtLink>
      </nav>
    </header>
    <SkipLink />
    <main id="main" class="rc-public-layout__main">
      <slot />
    </main>
    <footer class="rc-public-layout__footer">
      <p>&copy; {{ new Date().getFullYear() }} ReduCera</p>
    </footer>
  </div>
</template>

<style scoped>
.rc-public-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
.rc-public-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-public-layout__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rc-public-layout__home { font-weight: 600; }
.rc-public-layout__nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.rc-public-layout__nav a { padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
.rc-public-layout__nav a:hover { background: var(--ui-bg-muted, #f3f4f6); }
.rc-public-layout__login {
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  padding: 0.375rem 0.875rem !important;
  border-radius: 0.5rem !important;
}
.rc-public-layout__main {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem;
}
.rc-public-layout__footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: center;
  color: var(--ui-text-muted);
}
</style>