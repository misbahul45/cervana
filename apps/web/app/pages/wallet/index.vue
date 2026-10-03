<script setup lang="ts">
import { checkoutApi, walletApi } from '~/lib/api';

const [packages, wallet] = await Promise.all([
  checkoutApi.listCreditPackages().catch(() => [] as any[]),
  walletApi.me().catch(() => null as { balance: number; currency: string; recent: any[] } | null),
]);

useHead({ title: 'Dompet Saya — ReduCera' });
</script>

<template>
  <main>
    <h1>Dompet</h1>
    <p v-if="wallet">Saldo: <strong>{{ wallet.balance }} {{ wallet.currency }}</strong></p>

    <section>
      <h2>Beli Kredit</h2>
      <ul>
        <li v-for="pkg in packages" :key="pkg.id">
          <strong>{{ pkg.name }}</strong>
          <p>{{ pkg.creditAmount }} kredit — {{ pkg.priceAmount }} {{ pkg.priceCurrency }}</p>
          <NuxtLink :to="`/checkout/new?slug=${pkg.slug}`">Beli</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Aktivitas Terbaru</h2>
      <ul>
        <li v-for="tx in wallet?.recent ?? []" :key="tx.id">
          {{ tx.direction }} {{ tx.amount }} {{ tx.currency }} ({{ tx.category }})
        </li>
      </ul>
    </section>
  </main>
</template>