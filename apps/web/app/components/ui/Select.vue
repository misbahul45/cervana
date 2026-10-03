<script setup lang="ts">
const modelValue = defineModel<string | null>({ default: null });
defineProps<{ placeholder?: string; options: Array<{ value: string; label: string }> }>();
</script>

<template>
  <select
    v-model="modelValue"
    :placeholder="placeholder"
    class="form-select w-full px-3 py-2 rounded border border-[var(--rc-border)] bg-[var(--rc-bg)] text-[var(--rc-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--rc-primary)]"
  >
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>