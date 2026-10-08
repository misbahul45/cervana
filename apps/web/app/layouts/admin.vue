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
  <div class="rc-admin-layout">
    <SkipLink />
    <header class="rc-admin-layout__header">
      <BrandLogo to="/admin" suffix="Admin" label="Beranda admin" />
      <nav class="rc-admin-layout__nav" aria-label="Navigasi admin">
        <NuxtLink to="/admin">Beranda</NuxtLink>
        <NuxtLink to="/admin/payments">Pembayaran</NuxtLink>
        <NuxtLink to="/admin/payouts">Pencairan</NuxtLink>
        <NuxtLink to="/admin/refunds">Refund</NuxtLink>
        <NuxtLink to="/admin/teacher-applications">Aplikasi Guru</NuxtLink>
        <NuxtLink to="/admin/moderation">Moderasi</NuxtLink>
        <NuxtLink to="/admin/users">Pengguna</NuxtLink>
        <NuxtLink to="/admin/tenants">Tenant</NuxtLink>
        <NuxtLink to="/admin/agents">Agen</NuxtLink>
        <NuxtLink to="/admin/themes">Tema</NuxtLink>
        <NuxtLink to="/admin/optimization">Optimasi</NuxtLink>
        <NuxtLink to="/admin/audit">Audit</NuxtLink>
      </nav>
      <div class="rc-admin-layout__user">
        <button type="button" class="rc-btn rc-btn--sm rc-btn--outline" @click="logout">
          Keluar
        </button>
      </div>
    </header>
    <main id="main" class="rc-admin-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.rc-admin-layout { display: flex; flex-direction: column; min-height: 100vh; }
.rc-admin-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 2px solid #dc2626;
  gap: 1rem;
  flex-wrap: wrap;
  background: #fef2f2;
}
.rc-admin-layout__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; color: #991b1b; }
.rc-admin-layout__nav { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.rc-admin-layout__nav a { padding: 0.25rem 0.5rem; border-radius: 0.375rem; color: #7f1d1d; }
.rc-admin-layout__nav a:hover { background: #fee2e2; }
.rc-admin-layout__user { display: flex; gap: 0.5rem; align-items: center; }
.rc-admin-layout__logout {
  background: transparent;
  border: 1px solid #fca5a5;
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  color: #991b1b;
}
.rc-admin-layout__main { flex: 1; max-width: 96rem; margin: 0 auto; padding: 1.5rem; width: 100%; }
</style>