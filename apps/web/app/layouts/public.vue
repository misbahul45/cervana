<script setup lang="ts">
import { isNavActive } from '~/lib/nav';

const route = useRoute();
const year = useState<number>('public-year', () => new Date().getFullYear());
const active = (target: string) => isNavActive(target, route.path);
</script>

<template>
  <div class="rc-pub">
    <SkipLink />
    <header class="rc-pub__bar">
      <BrandLogo to="/" label="ReduCera - beranda" />
      <nav class="rc-pub__nav" aria-label="Navigasi utama">
        <NuxtLink to="/marketplace" class="rc-pub__link" :class="{ 'is-active': active('/marketplace') }" :aria-current="active('/marketplace') ? 'page' : undefined">
          Marketplace
        </NuxtLink>
        <NuxtLink to="/become-creator" class="rc-pub__link" :class="{ 'is-active': active('/become-creator') }" :aria-current="active('/become-creator') ? 'page' : undefined">
          Jadi kreator
        </NuxtLink>
      </nav>
      <div class="rc-pub__actions">
        <PlayButton to="/login" variant="ghost" size="sm">Masuk</PlayButton>
        <PlayButton to="/register" size="sm">Daftar gratis</PlayButton>
      </div>
    </header>

    <main id="main" class="rc-pub__main">
      <slot />
    </main>

    <footer class="rc-pub__foot">
      <p>&copy; {{ year }} ReduCera</p>
    </footer>
  </div>
</template>
