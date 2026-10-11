<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';

definePageMeta({
  title: 'Ringkasan Peninjau — ReduCera',
  protection: { kind: 'capability', capability: 'REVIEWER' },
});

useHead({ title: 'Ringkasan Peninjau — ReduCera' });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Ringkasan peninjau" subtitle="Metrik agregat platform untuk peninjau. Persetujuan konten dilakukan oleh admin." />
    <AdminAnalytics />
  </div>
</template>
