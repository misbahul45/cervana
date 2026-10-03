<script setup lang="ts">
import { ref, computed } from 'vue';
import { earningsApi } from '~/lib/api';

const [earnings, history] = await Promise.all([
  earningsApi.me().catch(() => null as { available: number; pending: number; currency: string } | null),
  earningsApi.history().catch(() => [] as any[]),
]);

useHead({ title: 'Pendapatan Saya — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Pendapatan</h1>
    <p v-if="earnings">Saldo tersedia: <strong>{{ earnings.available }} {{ earnings.currency }}</strong></p>
    <p v-if="earnings">Saldo tertahan (hold window): <strong>{{ earnings.pending }} {{ earnings.currency }}</strong></p>

    <section>
      <h2>Riwayat</h2>
      <ul>
        <li v-for="e in history" :key="e.id">
          {{ e.createdAt }} — {{ e.creatorAmount }} {{ e.currency }} ({{ e.status }})
        </li>
      </ul>
    </section>

    <NuxtLink to="/studio/withdrawals">Tarik saldo</NuxtLink>
  </main>
</template>