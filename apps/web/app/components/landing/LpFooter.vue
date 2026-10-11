<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';
</script>

<template>
  <footer class="lp-footer">
    <div class="lp-container lp-footer__bar">
      <BrandLogo to="/" size="sm" />
      <nav aria-label="Tautan bawah">
        <NuxtLink v-for="link in C.footer.links" :key="link.href" :to="link.href">{{ link.label }}</NuxtLink>
      </nav>
      <p>© {{ C.footer.rights }}</p>
    </div>
  </footer>
</template>
