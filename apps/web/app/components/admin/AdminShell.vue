<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import type { User } from '~/interfaces/auth';
import { ADMIN_NAV } from '~/lib/admin-nav';
import { isNavActive } from '~/lib/nav';
import { authService } from '~/services/auth';

const route = useRoute();
const user = useState<User | null>('user');
const skipCheck = useState<boolean>('skipCheck', () => false);
const queryClient = useQueryClient();
const menuOpen = ref(false);

const active = (target: string) => isNavActive(target, route.path);
const current = computed(() => ADMIN_NAV.find((item) => active(item.to)));

watch(
  () => route.path,
  () => {
    menuOpen.value = false;
  },
);

async function logout() {
  skipCheck.value = true;
  user.value = null;
  try {
    await authService.logout();
  } finally {
    queryClient.clear();
    await navigateTo('/login', { replace: true });
  }
}
</script>

<template>
  <div class="rc-shell rc-admin">
    <SkipLink />

    <aside class="rc-admin__rail" aria-label="Navigasi admin">
      <BrandLogo to="/admin/dashboard" suffix="Admin" label="Beranda admin" class="rc-admin__brand" />
      <nav class="rc-admin__nav">
        <NuxtLink
          v-for="item in ADMIN_NAV"
          :key="item.id"
          :to="item.to"
          class="rc-admin__link"
          :class="{ 'is-active': active(item.to) }"
          :aria-current="active(item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" class="rc-admin__icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <div class="rc-admin__foot">
        <PlayButton to="/learn/profile/dashboard" variant="outline" size="sm" block>Ke aplikasi</PlayButton>
        <PlayButton variant="ghost" size="sm" block @click="logout">Keluar</PlayButton>
      </div>
    </aside>

    <div class="rc-shell__main">
      <header class="rc-admin__bar">
        <BrandLogo to="/admin/dashboard" suffix="Admin" label="Beranda admin" size="sm" class="rc-admin__barbrand" />
        <p class="rc-admin__where">{{ current?.label ?? 'Admin' }}</p>
        <button
          type="button"
          class="rc-admin__menu"
          :aria-expanded="menuOpen"
          aria-controls="rc-admin-menu"
          @click="menuOpen = !menuOpen"
        >
          <UIcon :name="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </header>

      <nav v-show="menuOpen" id="rc-admin-menu" class="rc-admin__sheet" aria-label="Navigasi admin ponsel">
        <NuxtLink
          v-for="item in ADMIN_NAV"
          :key="item.id"
          :to="item.to"
          class="rc-admin__link"
          :class="{ 'is-active': active(item.to) }"
          :aria-current="active(item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" class="rc-admin__icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <PlayButton to="/learn/profile/dashboard" variant="outline" size="sm" block>Ke aplikasi</PlayButton>
        <PlayButton variant="ghost" size="sm" block @click="logout">Keluar</PlayButton>
      </nav>

      <main id="main" class="rc-admin__content">
        <slot />
      </main>
    </div>
  </div>
</template>
