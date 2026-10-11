<script setup lang="ts">
defineProps<{ title: string; data: Record<string, number | string | boolean> }>();

const label = (key: string | number) => String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());
</script>

<template>
  <section class="rc-card rc-statement">
    <h2 class="rc-h2">{{ title }}</h2>
    <dl class="rc-pay__summary">
      <div v-for="(value, key) in data" :key="key">
        <dt>{{ label(key) }}</dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
  </section>
</template>
