<script setup lang="ts">
import AuthShowcase from '~/components/auth/AuthShowcase.vue';
</script>

<template>
  <div class="rc-auth">
    <SkipLink />
    <section class="rc-auth__left">
      <header class="rc-auth__header">
        <BrandLogo label="Kembali ke beranda" />
      </header>
      <main id="main" class="rc-auth__main">
        <div class="rc-auth__card">
          <slot />
        </div>
      </main>
      <footer class="rc-auth__footer">
        <NuxtLink to="/">Beranda</NuxtLink>
      </footer>
    </section>
    <aside class="lp rc-auth__right" aria-label="Tentang ReduCera">
      <AuthShowcase />
    </aside>
  </div>
</template>
