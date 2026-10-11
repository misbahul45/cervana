<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';
import { loginHref } from '~/lib/next-path';
import { SIGNED_IN_HOME } from '~/lib/route-meta';

const route = useRoute();
const user = useState<{ id: string } | null>('user', () => null);
const year = useState<number>('reader-year', () => new Date().getFullYear());
const progress = ref(0);

function measure() {
  const root = document.documentElement;
  const scrollable = root.scrollHeight - window.innerHeight;
  progress.value = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
}

let frame = 0;
function onScroll() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    measure();
  });
}

onMounted(() => {
  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  if (frame) window.cancelAnimationFrame(frame);
});

watch(() => route.fullPath, () => {
  if (import.meta.client) nextTick(measure);
});
</script>

<template>
  <div class="rc-reader">
    <SkipLink />
    <div class="rc-reader__progress" aria-hidden="true"><span :style="{ transform: `scaleX(${progress})` }" /></div>
    <header class="rc-reader__bar">
      <div class="rc-reader__bar-start">
        <BrandLogo to="/" size="sm" label="ReduCera - beranda" />
        <NuxtLink to="/marketplace" class="rc-reader__back" aria-label="Kembali ke marketplace">
          <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
          <span class="rc-reader__back-text">Marketplace</span>
        </NuxtLink>
      </div>
      <div class="rc-reader__bar-end">
        <PlayButton v-if="user" :to="SIGNED_IN_HOME" variant="ghost" size="sm">Belajar</PlayButton>
        <template v-else>
          <PlayButton :to="loginHref(route.fullPath)" variant="ghost" size="sm">Masuk</PlayButton>
          <PlayButton to="/register" size="sm" class="rc-reader__signup">Daftar gratis</PlayButton>
        </template>
      </div>
    </header>

    <main id="main" class="rc-reader__main">
      <slot />
    </main>

    <footer class="rc-reader__foot">
      <p>&copy; {{ year }} ReduCera</p>
    </footer>
  </div>
</template>
