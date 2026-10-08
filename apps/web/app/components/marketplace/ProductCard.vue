<script setup lang="ts">
interface Props {
  title: string;
  creator?: string;
  priceLabel?: string;
  productType?: 'ARTIKEL' | 'KELAS' | 'SKENARIO';
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedMinutes?: number;
  owned?: boolean;
  to?: string;
}

defineProps<Props>();
</script>

<template>
  <NuxtLink :to="to || '#'" class="rc-product-card">
    <span
      :class="[
        'rc-product-card__type',
        `rc-product-card__type--${(productType || '').toLowerCase()}`,
      ]"
    >
      {{ productType }}
    </span>
    <h3 class="rc-product-card__title">{{ title }}</h3>
    <p v-if="creator" class="rc-product-card__creator">{{ creator }}</p>
    <p v-if="difficulty || estimatedMinutes" class="rc-product-card__meta">
      <span v-if="difficulty">{{ difficulty.toLowerCase() }}</span>
      <span v-if="estimatedMinutes">· ±{{ estimatedMinutes }} menit</span>
    </p>
    <footer class="rc-product-card__footer">
      <span v-if="owned" class="rc-product-card__owned">Sudah kamu miliki</span>
      <span v-else-if="priceLabel" class="rc-product-card__price">{{ priceLabel }}</span>
    </footer>
  </NuxtLink>
</template>

<style scoped>
.rc-product-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.75rem;
  background: var(--ui-bg, white);
  color: var(--ui-text);
  text-decoration: none;
}
.rc-product-card:hover {
  border-color: var(--ui-primary, #2563eb);
}
.rc-product-card__type {
  display: inline-block;
  align-self: flex-start;
  font-size: 0.625rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted, #f3f4f6);
  color: var(--ui-text-muted);
}
.rc-product-card__type--artikel  { background: #dbeafe; color: #1e40af; }
.rc-product-card__type--kelas    { background: #ede9fe; color: #5b21b6; }
.rc-product-card__type--skenario { background: #fef3c7; color: #92400e; }
.rc-product-card__title { font-size: 1rem; font-weight: 600; }
.rc-product-card__creator { font-size: 0.875rem; color: var(--ui-text-muted); }
.rc-product-card__meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  text-transform: capitalize;
}
.rc-product-card__footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rc-product-card__owned {
  font-size: 0.875rem;
  font-weight: 600;
  color: #16a34a;
}
.rc-product-card__price {
  font-size: 0.875rem;
  font-weight: 600;
}
</style>