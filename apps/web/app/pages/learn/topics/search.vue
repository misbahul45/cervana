<script setup lang="ts">
const route = useRoute();

const requested = [route.query.kategori, route.query.include, route.query.category].find((value) => typeof value === 'string' && value.trim());

await navigateTo(
  { path: '/learn/topics', query: requested ? { kategori: String(requested) } : {} },
  { replace: true },
);
</script>

<template>
  <div />
</template>
