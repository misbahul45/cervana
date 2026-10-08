<script setup lang="ts">
definePageMeta({
  title: 'Moderasi — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});
</script>

<template>
  <NuxtPage />
</template>
