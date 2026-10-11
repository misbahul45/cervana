<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';

const user = useState('user');
</script>

<template>
  <header class="lp-header">
    <div class="lp-container lp-header__bar">
      <BrandLogo to="/" class="lp-header__brand" />
      <nav class="lp-header__nav" aria-label="Bagian halaman">
        <a v-for="item in C.nav" :key="item.href" :href="item.href">{{ item.label }}</a>
      </nav>
      <div class="lp-header__end">
        <NuxtLink v-if="!user" to="/login" class="lp-link">Masuk</NuxtLink>
        <NuxtLink :to="user ? '/learn/profile/dashboard' : '/register'" class="lp-btn lp-btn--sm">{{ user ? 'Buka aplikasi' : 'Daftar gratis' }}</NuxtLink>
      </div>
    </div>
  </header>
</template>
