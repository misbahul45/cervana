<script setup lang="ts">
import { computed } from 'vue';
import { checkoutApi } from '~/lib/api';

const route = useRoute();
const slug = computed(() => String(route.query.slug ?? ''));

async function buy() {
  const key = `web-${slug.value}-${Date.now()}`;
  const result = await checkoutApi.purchase(slug.value, key);
  if (result?.orderId) {
    await navigateTo(`/checkout/${result.orderId}`);
  }
}

useHead({ title: 'Membuat Pesanan — ReduCera' });
</script>

<template>
  <main>
    <h1>Membuat pesanan untuk paket {{ slug }}…</h1>
    <button @click="buy">Lanjut ke Pembayaran</button>
  </main>
</template>