<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';
import { STUDIO_NAV, studioNavActive } from '~/lib/studio-nav';
import { SIGNED_IN_HOME } from '~/lib/route-meta';
import { authService } from '~/services/auth';

const route = useRoute();
const user = useState<{ id: string } | null>('user', () => null);

async function logout() {
  await authService.logout();
  user.value = null;
  await navigateTo('/login');
}
</script>

<template>
  <div class="rc-studio">
    <SkipLink />
    <header class="rc-studio__bar">
      <BrandLogo to="/studio" suffix="Studio" size="sm" label="Beranda studio" />
      <div class="rc-studio__bar-end">
        <PlayButton :to="SIGNED_IN_HOME" variant="ghost" size="sm">Belajar</PlayButton>
        <PlayButton to="/marketplace" variant="ghost" size="sm">Marketplace</PlayButton>
        <PlayButton variant="secondary" size="sm" @click="logout">Keluar</PlayButton>
      </div>
    </header>
    <nav class="rc-studio__nav" aria-label="Navigasi studio">
      <NuxtLink
        v-for="item in STUDIO_NAV"
        :key="item.id"
        :to="item.to"
        class="rc-studio__link"
        :class="{ 'is-active': studioNavActive(item, route.path) }"
        :aria-current="studioNavActive(item, route.path) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>
    <main id="main" class="rc-studio__main">
      <slot />
    </main>
  </div>
</template>
