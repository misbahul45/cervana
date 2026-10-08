<script setup lang="ts">
import { useState } from '#imports';
import { authService } from '~/services/auth';

const user = useState('user');

function logout() {
  authService.logout().finally(() => {
    user.value = null;
    navigateTo('/login');
  });
}
</script>

<template>
  <div class="rc-studio-layout">
    <SkipLink />
    <header class="rc-studio-layout__header">
      <BrandLogo to="/studio" suffix="Studio" label="Beranda studio" />
      <nav class="rc-studio-layout__nav" aria-label="Navigasi studio">
        <NuxtLink to="/studio">Beranda</NuxtLink>
        <NuxtLink to="/studio/articles">Artikel</NuxtLink>
        <NuxtLink to="/studio/classes">Kelas</NuxtLink>
        <NuxtLink to="/studio/scenarios">Skenario</NuxtLink>
        <NuxtLink to="/studio/agents">Agen</NuxtLink>
        <NuxtLink to="/studio/earnings">Pendapatan</NuxtLink>
        <NuxtLink to="/studio/payouts">Pencairan</NuxtLink>
        <NuxtLink to="/studio/settings">Pengaturan</NuxtLink>
      </nav>
      <div class="rc-studio-layout__user">
        <TenantSwitcher />
        <button type="button" class="rc-btn rc-btn--sm rc-btn--outline" @click="logout">
          Keluar
        </button>
      </div>
    </header>
    <main id="main" class="rc-studio-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.rc-studio-layout { display: flex; flex-direction: column; min-height: 100vh; }
.rc-studio-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  gap: 1rem;
  flex-wrap: wrap;
}
.rc-studio-layout__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; }
.rc-studio-layout__nav { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.rc-studio-layout__nav a { padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
.rc-studio-layout__nav a:hover { background: var(--ui-bg-muted, #f3f4f6); }
.rc-studio-layout__user { display: flex; gap: 0.5rem; align-items: center; }
.rc-studio-layout__logout {
  background: transparent;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
}
.rc-studio-layout__main { flex: 1; max-width: 96rem; margin: 0 auto; padding: 1.5rem; width: 100%; }
</style>