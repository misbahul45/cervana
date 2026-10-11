<script setup lang="ts">
import { LANDING_COPY as C } from '~/lib/landing-copy';

const sampleWeek = [
  { name: 'Sen', state: 'done' },
  { name: 'Sel', state: 'done' },
  { name: 'Rab', state: 'done' },
  { name: 'Kam', state: 'frozen' },
  { name: 'Jum', state: 'done' },
  { name: 'Sab', state: 'done' },
  { name: 'Min', state: 'today' },
] as const;
</script>

<template>
  <section class="lp-hero" aria-labelledby="hero-title">
    <div class="lp-container lp-hero__inner">
      <h1 id="hero-title" class="lp-hero__title">
        {{ C.hero.headlineA }} <em class="lp-accent">{{ C.hero.accentA }}</em>{{ C.hero.headlineB }} <em>{{ C.hero.accentB }}</em>
      </h1>
      <p class="lp-hero__sub">{{ C.hero.sub }}</p>
      <div class="lp-hero__actions">
        <NuxtLink to="/register" class="lp-btn">{{ C.hero.primary }}</NuxtLink>
        <a href="#cara-kerja" class="lp-link lp-link--arrow">{{ C.hero.secondary }}</a>
      </div>

      <figure class="lp-demo" :aria-label="`${C.hero.demoLabel}: streak, XP, dan pencapaian`">
        <div class="lp-demo__grid">
          <div class="lp-demo__card">
            <div class="lp-demo__row">
              <GameIcon name="streak" :size="44" decorative />
              <div>
                <p class="lp-demo__big">7 hari</p>
                <p class="lp-demo__small">Streak aman hari ini</p>
              </div>
            </div>
            <ol class="lp-week" aria-label="Contoh streak tujuh hari">
              <li v-for="day in sampleWeek" :key="day.name" :class="`lp-week__day lp-week__day--${day.state}`">
                <span>{{ day.name }}</span>
                <i aria-hidden="true">
                  <GameIcon v-if="day.state === 'done'" name="streak" :size="16" decorative />
                  <GameIcon v-else-if="day.state === 'frozen'" name="freeze" :size="16" decorative />
                </i>
              </li>
            </ol>
          </div>
          <div class="lp-demo__card">
            <div class="lp-demo__row">
              <GameIcon name="xp" :size="44" decorative />
              <div>
                <p class="lp-demo__big">+50 XP</p>
                <p class="lp-demo__small">Konsep lulus: Persamaan Akuntansi</p>
              </div>
            </div>
            <div class="lp-bar" role="img" aria-label="Contoh kemajuan level, 81 persen"><span style="width: 81%" /></div>
            <p class="lp-demo__small">Level 1 · 19 XP lagi ke level 2</p>
          </div>
          <div class="lp-demo__card lp-demo__card--wide">
            <div class="lp-demo__row">
              <GameIcon name="badge" :size="44" decorative />
              <div>
                <p class="lp-demo__big">Seminggu Penuh</p>
                <p class="lp-demo__small">Pencapaian baru · pembeku streak diperoleh</p>
              </div>
            </div>
          </div>
        </div>
      </figure>
    </div>
  </section>
</template>
