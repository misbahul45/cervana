<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';

definePageMeta({
  title: 'Analitik — ReduCera Admin',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Analitik — ReduCera Admin' });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Analitik" subtitle="Metrik agregat platform. Tidak ada data pribadi pelajar di halaman ini." />
    <AdminAnalytics />
  </div>
</template>
