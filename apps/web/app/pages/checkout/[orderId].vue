<script setup lang="ts">
import { computed } from 'vue';

const route = useRoute();
const orderId = computed(() => String(route.params.orderId));
const error = ref('');

async function pay(method: 'MANUAL_BANK' | 'PAYMENT_PROVIDER') {
  try {
    await $fetch(`/api/v1/orders/${orderId.value}/pay`, {
      method: 'POST',
      body: { method },
    });
    await navigateTo(`/checkout/${orderId.value}/success`);
  } catch (e: any) {
    error.value = e?.data?.message ?? 'payment_failed';
  }
}

useHead({ title: 'Checkout — ReduCera' });
</script>

<template>
  <main>
    <h1>Checkout {{ orderId }}</h1>
    <section>
      <h2>Metode Pembayaran</h2>
      <button @click="pay('MANUAL_BANK')">Transfer Bank Manual</button>
      <button @click="pay('PAYMENT_PROVIDER')">Payment Provider Otomatis</button>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
    <NuxtLink to="/wallet">Kembali ke Dompet</NuxtLink>
  </main>
</template>