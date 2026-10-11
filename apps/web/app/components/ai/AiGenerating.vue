<script setup lang="ts">
import { computed } from 'vue';
import AiFactChips from '~/components/ai/AiFactChips.vue';
import { currentStage, factsOf, type AiStage } from '~/lib/ai-stages';

const props = withDefaults(
  defineProps<{
    title: string;
    stages: AiStage[];
    compact?: boolean;
    note?: string;
  }>(),
  { compact: false, note: '' },
);

const current = computed(() => currentStage(props.stages));
const facts = computed(() => factsOf(props.stages));
const writing = computed(() => current.value?.key === 'writing' && current.value.state === 'active');
const live = computed(() => {
  const stage = current.value;
  if (!stage) return props.title;
  return stage.detail ? `${stage.label}. ${stage.detail}` : stage.label;
});
</script>

<template>
  <section class="rc-ai" :class="{ 'rc-ai--compact': compact }" aria-busy="true">
    <span class="rc-ai__scan" aria-hidden="true"></span>

    <header class="rc-ai__head">
      <div class="rc-ai__orb" aria-hidden="true">
        <span class="rc-ai__ring"></span>
        <span class="rc-ai__ring rc-ai__ring--inner"></span>
        <span class="rc-ai__core"></span>
        <span v-for="n in 3" :key="n" class="rc-ai__node" :style="{ '--i': n }"></span>
      </div>
      <div class="rc-ai__headline">
        <h2 class="rc-ai__title">{{ title }}</h2>
        <p class="rc-ai__live" role="status" aria-live="polite">{{ live }}</p>
      </div>
    </header>

    <ol v-if="!compact" class="rc-ai__steps">
      <li v-for="stage in stages" :key="stage.key" class="rc-ai__step" :data-state="stage.state">
        <span class="rc-ai__mark" aria-hidden="true">
          <svg v-if="stage.state === 'done'" class="rc-ai__check" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
          </svg>
          <span v-else-if="stage.state === 'failed'" class="rc-ai__bang">!</span>
          <span v-else-if="stage.state === 'skipped'" class="rc-ai__dash"></span>
          <span v-else-if="stage.state === 'active'" class="rc-ai__spin"></span>
        </span>
        <div class="rc-ai__body">
          <p class="rc-ai__label">{{ stage.label }}</p>
          <Transition name="rc-ai-fade" mode="out-in">
            <p v-if="stage.detail" :key="stage.detail" class="rc-ai__detail">{{ stage.detail }}</p>
          </Transition>
          <div v-if="stage.key === 'writing' && writing" class="rc-ai__ink" aria-hidden="true">
            <span v-for="n in 3" :key="n" :style="{ '--i': n }"></span>
          </div>
        </div>
      </li>
    </ol>

    <AiFactChips v-if="!compact && facts.length" :facts="facts" animated />

    <p v-if="note" class="rc-ai__note">{{ note }}</p>
  </section>
</template>

<style>
.rc-ai {
  position: relative;
  display: grid;
  gap: 1.25rem;
  padding: 1.25rem;
  overflow: hidden;
  isolation: isolate;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
}
.rc-ai::before {
  content: '';
  position: absolute;
  inset: -35%;
  z-index: -2;
  background:
    radial-gradient(38% 38% at 18% 24%, color-mix(in srgb, var(--rc-primary) 24%, transparent), transparent 70%),
    radial-gradient(36% 36% at 82% 18%, color-mix(in srgb, var(--rc-secondary) 22%, transparent), transparent 70%),
    radial-gradient(42% 42% at 62% 92%, color-mix(in srgb, var(--rc-gold) 20%, transparent), transparent 70%);
  filter: blur(10px);
  animation: rc-ai-drift 16s ease-in-out infinite alternate;
}
.rc-ai::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(color-mix(in srgb, var(--rc-fg) 14%, transparent) 1px, transparent 1.5px);
  background-size: 18px 18px;
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent 85%);
  mask-image: linear-gradient(to bottom, #000, transparent 85%);
}
.rc-ai__scan {
  position: absolute;
  inset: 0 0 auto;
  z-index: -1;
  height: 38%;
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--rc-secondary) 14%, transparent), transparent);
  animation: rc-ai-scan 4.5s ease-in-out infinite;
}

.rc-ai__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
}
.rc-ai__title {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.3;
}
.rc-ai__live {
  margin: 0.25rem 0 0;
  color: var(--rc-muted);
  font-size: 0.9375rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  animation: rc-ai-breathe-text 2.4s ease-in-out infinite;
}

.rc-ai__orb {
  position: relative;
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
}
.rc-ai__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--rc-primary), var(--rc-secondary), var(--rc-gold), var(--rc-primary));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
  animation: rc-ai-spin 3.2s linear infinite;
}
.rc-ai__ring--inner {
  inset: 0.7rem;
  opacity: 0.65;
  animation-duration: 5s;
  animation-direction: reverse;
}
.rc-ai__core {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--rc-gold), var(--rc-primary));
  box-shadow: 0 0 1.25rem color-mix(in srgb, var(--rc-primary) 55%, transparent);
  animation: rc-ai-breathe 2.4s ease-in-out infinite;
}
.rc-ai__node {
  position: absolute;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background-color: var(--rc-gold);
  box-shadow: 0 0 0.5rem color-mix(in srgb, var(--rc-gold) 70%, transparent);
  animation: rc-ai-orbit 5s linear infinite;
  animation-delay: calc(var(--i) * -1.6667s);
}

.rc-ai__steps {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-ai__step {
  position: relative;
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  gap: 0.75rem;
  padding-bottom: 1rem;
}
.rc-ai__step:last-child {
  padding-bottom: 0;
}
.rc-ai__step::before {
  content: '';
  position: absolute;
  top: 1.75rem;
  bottom: 0;
  left: calc(0.875rem - 1px);
  width: 2px;
  background-color: var(--rc-border);
  transition: background-color 0.5s ease;
}
.rc-ai__step:last-child::before {
  display: none;
}
.rc-ai__step[data-state='done']::before {
  background-color: var(--rc-primary);
}
.rc-ai__mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--rc-border);
  border-radius: 50%;
  background-color: var(--rc-surface);
  transition:
    background-color 0.35s ease,
    border-color 0.35s ease;
}
.rc-ai__step[data-state='active'] .rc-ai__mark {
  border-color: var(--rc-secondary);
}
.rc-ai__step[data-state='done'] .rc-ai__mark {
  border-color: var(--rc-primary);
  background-color: var(--rc-primary);
}
.rc-ai__step[data-state='failed'] .rc-ai__mark {
  border-color: var(--rc-warning);
  background-color: color-mix(in srgb, var(--rc-warning) 16%, var(--rc-surface));
}
.rc-ai__step[data-state='skipped'] .rc-ai__mark {
  border-style: dashed;
}
.rc-ai__spin {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid color-mix(in srgb, var(--rc-secondary) 25%, transparent);
  border-top-color: var(--rc-secondary);
  border-radius: 50%;
  animation: rc-ai-spin 0.8s linear infinite;
}
.rc-ai__check {
  width: 1rem;
  height: 1rem;
}
.rc-ai__check path {
  stroke: var(--rc-primary-fg);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: rc-ai-draw 0.45s ease-out forwards;
}
.rc-ai__bang {
  color: var(--rc-warning);
  font-size: 0.875rem;
  font-weight: 900;
  line-height: 1;
}
.rc-ai__dash {
  width: 0.6rem;
  height: 2px;
  border-radius: 2px;
  background-color: var(--rc-muted);
}

.rc-ai__body {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}
.rc-ai__label {
  margin: 0;
  color: var(--rc-muted);
  font-weight: 800;
  transition: color 0.3s ease;
}
.rc-ai__step[data-state='active'] .rc-ai__label,
.rc-ai__step[data-state='done'] .rc-ai__label,
.rc-ai__step[data-state='failed'] .rc-ai__label {
  color: var(--rc-fg);
}
.rc-ai__detail {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.rc-ai__ink {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.rc-ai__ink span {
  display: block;
  height: 0.55rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--rc-primary), var(--rc-secondary), var(--rc-gold), var(--rc-primary));
  background-size: 220% 100%;
  transform-origin: left center;
  animation:
    rc-ai-ink 1.9s ease-in-out infinite,
    rc-ai-flow 3s linear infinite;
  animation-delay: calc(var(--i) * 0.22s), 0s;
}
.rc-ai__ink span:nth-child(2) {
  width: 82%;
}
.rc-ai__ink span:nth-child(3) {
  width: 56%;
}
.rc-ai__note {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.rc-ai--compact {
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}
.rc-ai--compact .rc-ai__orb {
  width: 3rem;
  height: 3rem;
}
.rc-ai--compact .rc-ai__ring {
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
}
.rc-ai--compact .rc-ai__ring--inner {
  inset: 0.5rem;
}
.rc-ai--compact .rc-ai__core {
  width: 1rem;
  height: 1rem;
}
.rc-ai--compact .rc-ai__node {
  display: none;
}
.rc-ai--compact .rc-ai__title {
  font-size: 1.0625rem;
}

.rc-ai-fade-enter-active,
.rc-ai-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.rc-ai-fade-enter-from {
  opacity: 0;
  transform: translateY(0.25rem);
}
.rc-ai-fade-leave-to {
  opacity: 0;
}

@keyframes rc-ai-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes rc-ai-orbit {
  from {
    transform: rotate(0deg) translateX(2.55rem) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(2.55rem) rotate(-360deg);
  }
}
@keyframes rc-ai-breathe {
  0%,
  100% {
    transform: scale(0.88);
  }
  50% {
    transform: scale(1.12);
  }
}
@keyframes rc-ai-breathe-text {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}
@keyframes rc-ai-drift {
  from {
    transform: translate3d(-4%, -3%, 0) rotate(0deg);
  }
  to {
    transform: translate3d(4%, 3%, 0) rotate(8deg);
  }
}
@keyframes rc-ai-scan {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(280%);
  }
}
@keyframes rc-ai-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes rc-ai-ink {
  0%,
  100% {
    transform: scaleX(0.3);
    opacity: 0.55;
  }
  55% {
    transform: scaleX(1);
    opacity: 1;
  }
}
@keyframes rc-ai-flow {
  to {
    background-position: -220% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rc-ai::before,
  .rc-ai__scan,
  .rc-ai__ring,
  .rc-ai__core,
  .rc-ai__node,
  .rc-ai__live,
  .rc-ai__ink span {
    animation: none;
  }
  .rc-ai__spin {
    animation-duration: 2.4s;
  }
  .rc-ai__check path {
    animation: none;
    stroke-dashoffset: 0;
  }
  .rc-ai__ink span {
    transform: none;
    opacity: 0.85;
  }
  .rc-ai__scan {
    display: none;
  }
  .rc-ai-fade-enter-active,
  .rc-ai-fade-leave-active {
    transition: none;
  }
}
</style>
