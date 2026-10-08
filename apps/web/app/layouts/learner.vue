<script setup lang="ts">
import { useState } from '#imports';
import { authService } from '~/services/auth';

const user = useState('user');
const sidebarOpen = useState('learner-sidebar-open', () => true);

function logout() {
  authService.logout().finally(() => {
    user.value = null;
    navigateTo('/login');
  });
}
</script>

<template>
  <div class="rc-learner-layout">
    <SkipLink />
    <header class="rc-learner-layout__header">
      <BrandLogo to="/learn/profile/dashboard" label="Beranda learner" />
      <nav class="rc-learner-layout__nav" aria-label="Navigasi learner">
        <NuxtLink to="/learn/profile/dashboard">Beranda</NuxtLink>
        <NuxtLink to="/learn/path">Peta Keterampilan</NuxtLink>
        <NuxtLink to="/my-learning/lessons">Pelajaran</NuxtLink>
        <NuxtLink to="/sandbox">Sandbox</NuxtLink>
        <NuxtLink to="/credits">Kredit</NuxtLink>
        <NuxtLink to="/marketplace">Marketplace</NuxtLink>
      </nav>
      <div class="rc-learner-layout__user">
        <TenantSwitcher />
        <button type="button" class="rc-btn rc-btn--sm rc-btn--outline" @click="logout">
          Keluar
        </button>
      </div>
    </header>
    <main id="main" class="rc-learner-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.rc-learner-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.rc-learner-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  gap: 1rem;
  flex-wrap: wrap;
}
.rc-learner-layout__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.rc-learner-layout__nav {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.rc-learner-layout__nav a {
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}
.rc-learner-layout__nav a:hover {
  background: var(--ui-bg-muted, #f3f4f6);
}
.rc-learner-layout__user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rc-learner-layout__logout {
  background: transparent;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
}
.rc-learner-layout__main {
  flex: 1;
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem;
}
</style>