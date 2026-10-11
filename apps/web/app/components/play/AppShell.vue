<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import type { User } from '~/interfaces/auth';
import { useGamifyMe } from '~/composables/useGamify';
import { useHydrated } from '~/composables/useHydrated';
import { LEARNER_NAV, isNavActive, tabItems } from '~/lib/nav';
import { authService } from '~/services/auth';

const route = useRoute();
const user = useState<User | null>('user');
const skipCheck = useState<boolean>('skipCheck', () => false);
const queryClient = useQueryClient();
const { data: me } = useGamifyMe();
const hydrated = useHydrated();
const tabs = tabItems();

const active = (target: string) => isNavActive(target, route.path);

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
  <div class="rc-shell">
    <SkipLink />

    <aside class="rc-rail" aria-label="Navigasi utama">
      <BrandLogo to="/learn/profile/dashboard" class="rc-rail__brand" />
      <nav class="rc-rail__nav">
        <NuxtLink
          v-for="item in LEARNER_NAV"
          :key="item.id"
          :to="item.to"
          class="rc-rail__link"
          :class="{ 'is-active': active(item.to) }"
          :aria-current="active(item.to) ? 'page' : undefined"
        >
          <GameIcon v-if="item.icon.kind === 'game'" :name="item.icon.name" :size="28" decorative />
          <UIcon v-else :name="item.icon.name" class="rc-rail__icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <button v-if="user" type="button" class="rc-btn rc-btn--ghost rc-btn--sm rc-rail__logout" @click="logout">Keluar</button>
      <div v-else class="rc-rail__guest">
        <PlayButton to="/register" block>Daftar gratis</PlayButton>
        <PlayButton to="/login" variant="outline" block>Masuk</PlayButton>
      </div>
    </aside>

    <div class="rc-shell__main">
      <header class="rc-hud" aria-label="Ringkasan belajar">
        <div v-if="user && hydrated && me" class="rc-hud__stats">
          <NuxtLink to="/learn/streaks" class="rc-hud__link" aria-label="Streak harian">
            <StatPill icon="streak" :value="me.streak.current" label="Streak" tone="flame" />
          </NuxtLink>
          <NuxtLink to="/learn/profile/me" class="rc-hud__link" aria-label="Total XP">
            <StatPill icon="xp" :value="me.xp" label="XP" tone="gold" />
          </NuxtLink>
          <NuxtLink to="/learn/achievements" class="rc-hud__link" aria-label="Bintang">
            <StatPill icon="star" :value="me.stars" label="Bintang" tone="gold" />
          </NuxtLink>
          <NuxtLink to="/learn/profile/me" class="rc-hud__link rc-hud__level" aria-label="Level">
            <GameIcon name="level" :size="26" decorative />
            <span>Level {{ me.level.level }}</span>
          </NuxtLink>
        </div>
        <div v-else-if="user" class="rc-hud__stats rc-hud__stats--loading" aria-hidden="true">
          <span class="rc-hud__ghost" />
          <span class="rc-hud__ghost" />
          <span class="rc-hud__ghost" />
        </div>
        <div v-else class="rc-hud__stats">
          <span class="rc-hint">Masuk untuk menyimpan streak dan XP-mu.</span>
        </div>
        <div class="rc-hud__end">
          <TenantSwitcher v-if="user" />
          <PlayButton v-else to="/login" size="sm">Masuk</PlayButton>
        </div>
      </header>

      <main id="main" class="rc-shell__content">
        <slot />
      </main>
    </div>

    <nav class="rc-tabs" aria-label="Navigasi utama ponsel">
      <NuxtLink
        v-for="item in tabs"
        :key="item.id"
        :to="item.to"
        class="rc-tabs__link"
        :class="{ 'is-active': active(item.to) }"
        :aria-current="active(item.to) ? 'page' : undefined"
      >
        <GameIcon v-if="item.icon.kind === 'game'" :name="item.icon.name" :size="26" decorative />
        <UIcon v-else :name="item.icon.name" class="rc-tabs__icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style>
.rc-shell {
  min-height: 100vh;
  background-color: var(--rc-bg);
  color: var(--rc-fg);
}

.rc-rail {
  display: none;
}

.rc-shell__main {
  min-width: 0;
}

.rc-hud {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 1rem;
  border-bottom: 2px solid var(--rc-border);
  background-color: color-mix(in srgb, var(--rc-bg) 92%, transparent);
  backdrop-filter: blur(8px);
}

.rc-hud__stats {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  min-width: 0;
}

.rc-hud__link {
  display: inline-flex;
  align-items: center;
  border-radius: 0.75rem;
  color: inherit;
  text-decoration: none;
}

.rc-hud__link:hover {
  background-color: var(--rc-foam);
}

.rc-hud__level {
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  font-weight: 900;
  white-space: nowrap;
}

.rc-hud__ghost {
  display: block;
  width: 3.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background-color: var(--rc-border);
}

.rc-hud__end {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rc-shell__content {
  width: 100%;
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 6.5rem;
}

.rc-tabs {
  position: fixed;
  inset: auto 0 0;
  z-index: 40;
  display: flex;
  justify-content: space-around;
  padding: 0.375rem 0.25rem calc(0.375rem + env(safe-area-inset-bottom, 0px));
  border-top: 2px solid var(--rc-border);
  background-color: var(--rc-surface);
}

.rc-tabs__link {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.25rem;
  border: 2px solid transparent;
  border-radius: 0.875rem;
  color: var(--rc-muted);
  font-size: 0.6875rem;
  font-weight: 800;
  text-decoration: none;
}

.rc-tabs__link.is-active {
  border-color: var(--rc-info);
  background-color: color-mix(in srgb, var(--rc-info) 12%, var(--rc-surface));
  color: var(--rc-secondary);
}

.rc-tabs__icon {
  width: 1.625rem;
  height: 1.625rem;
}

@media (min-width: 1024px) {
  .rc-shell {
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr);
  }

  .rc-rail {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100vh;
    padding: 1.25rem 1rem;
    border-right: 2px solid var(--rc-border);
    background-color: var(--rc-surface);
  }

  .rc-rail__brand {
    margin: 0 0.5rem 0.75rem;
  }

  .rc-rail__nav {
    display: grid;
    flex: 1;
    align-content: start;
    gap: 0.25rem;
    overflow-y: auto;
  }

  .rc-rail__link {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.625rem 0.875rem;
    border: 2px solid transparent;
    border-radius: var(--rc-radius, 16px);
    color: var(--rc-muted);
    font-size: 0.9375rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .rc-rail__link:hover {
    background-color: var(--rc-foam);
  }

  .rc-rail__link.is-active {
    border-color: var(--rc-info);
    background-color: color-mix(in srgb, var(--rc-info) 12%, var(--rc-surface));
    color: var(--rc-secondary);
  }

  .rc-rail__icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .rc-rail__logout {
    align-self: stretch;
  }

  .rc-rail__guest {
    display: grid;
    gap: 0.75rem;
  }

  .rc-tabs {
    display: none;
  }

  .rc-shell__content {
    padding-bottom: 3rem;
  }
}

@media (max-width: 480px) {
  .rc-hud__stats {
    gap: 0.75rem;
  }

  .rc-hud__level span {
    display: none;
  }
}
</style>
