<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 400"
    role="img"
    aria-label="Ocean illustration: a pearl glowing in deep water"
    class="w-full h-auto"
  >
    <defs>
      <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--rc-surface)" stop-opacity="0" />
        <stop offset="1" stop-color="var(--rc-primary)" stop-opacity="0.25" />
      </linearGradient>
      <radialGradient id="pearl" cx="0.4" cy="0.4" r="0.6">
        <stop offset="0" stop-color="var(--rc-surface)" />
        <stop offset="0.6" stop-color="var(--rc-primary)" stop-opacity="0.7" />
        <stop offset="1" stop-color="var(--rc-secondary)" />
      </radialGradient>
      <radialGradient id="caustic" cx="0.5" cy="0.2" r="0.7">
        <stop offset="0" stop-color="var(--rc-accent)" stop-opacity="0.18" />
        <stop offset="1" stop-color="var(--rc-accent)" stop-opacity="0" />
      </radialGradient>
    </defs>

    <rect x="0" y="0" width="400" height="400" fill="url(#depth)" />
    <rect x="0" y="0" width="400" height="400" fill="url(#caustic)" />

    <circle cx="120" cy="320" r="6" fill="var(--rc-accent)" opacity="0.6">
      <animate attributeName="cy" values="320;80;320" dur="6s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.7;0" dur="6s" repeatCount="indefinite" />
    </circle>
    <circle cx="280" cy="340" r="4" fill="var(--rc-primary)" opacity="0.6">
      <animate attributeName="cy" values="340;60;340" dur="8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.6;0" dur="8s" repeatCount="indefinite" />
    </circle>
    <circle cx="200" cy="360" r="5" fill="var(--rc-secondary)" opacity="0.5">
      <animate attributeName="cy" values="360;120;360" dur="7s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.5;0" dur="7s" repeatCount="indefinite" />
    </circle>

    <g class="bob-motion-safe">
      <circle cx="200" cy="220" r="80" fill="url(#pearl)" />
      <circle cx="170" cy="190" r="20" fill="var(--rc-fg)" opacity="0.25" />
    </g>

    <path
      d="M0 360 Q100 340 200 360 T400 360 L400 400 L0 400 Z"
      fill="var(--rc-primary)"
      opacity="0.35"
    />
    <path
      d="M0 380 Q100 365 200 380 T400 380 L400 400 L0 400 Z"
      fill="var(--rc-secondary)"
      opacity="0.45"
    />
  </svg>
</template>

<script setup lang="ts">
</script>

<style scoped>
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@media (prefers-reduced-motion: no-preference) {
  .bob-motion-safe {
    animation: bob 5s ease-in-out infinite;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bob-motion-safe {
    animation: none;
  }
}
</style>