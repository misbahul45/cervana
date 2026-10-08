<script setup lang="ts">
interface Props {
  debit?: number;
  credit?: number;
}

const props = withDefaults(defineProps<Props>(), {
  debit: 0,
  credit: 0,
});

const balanced = computed(() => Math.abs(props.debit - props.credit) < 0.01);
const delta = computed(() => props.debit - props.credit);
</script>

<template>
  <div
    class="rc-debit-credit-total"
    :class="balanced ? 'rc-debit-credit-total--balanced' : 'rc-debit-credit-total--unbalanced'"
    role="status"
    aria-live="polite"
  >
    <div class="rc-debit-credit-total__line">
      <span class="rc-debit-credit-total__label">Total Debit</span>
      <span class="rc-debit-credit-total__amount">{{ debit.toFixed(2) }}</span>
    </div>
    <div class="rc-debit-credit-total__line">
      <span class="rc-debit-credit-total__label">Total Credit</span>
      <span class="rc-debit-credit-total__amount">{{ credit.toFixed(2) }}</span>
    </div>
    <div class="rc-debit-credit-total__delta">
      Selisih: <strong>{{ delta.toFixed(2) }}</strong>
      <span v-if="balanced" class="rc-debit-credit-total__ok">Seimbang</span>
      <span v-else class="rc-debit-credit-total__bad">Tidak seimbang</span>
    </div>
  </div>
</template>

<style scoped>
.rc-debit-credit-total {
  display: grid;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-debit-credit-total--balanced { border-color: #16a34a; }
.rc-debit-credit-total--unbalanced { border-color: #d97706; }
.rc-debit-credit-total__line {
  display: flex;
  justify-content: space-between;
}
.rc-debit-credit-total__label { color: var(--ui-text-muted); }
.rc-debit-credit-total__amount { font-weight: 600; }
.rc-debit-credit-total__delta {
  padding-top: 0.5rem;
  border-top: 1px dashed var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-debit-credit-total__ok { color: #16a34a; margin-left: 0.5rem; }
.rc-debit-credit-total__bad { color: #d97706; margin-left: 0.5rem; }
</style>