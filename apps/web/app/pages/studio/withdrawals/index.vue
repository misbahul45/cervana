<script setup lang="ts">
import { ref } from 'vue';
import { earningsApi, withdrawalApi } from '~/lib/api';

const [earnings, history] = await Promise.all([
  earningsApi.me().catch(() => null as { available: number; pending: number; currency: string } | null),
  withdrawalApi.list().catch(() => [] as any[]),
]);

const amount = ref(0);
const submitting = ref(false);
const error = ref('');

async function submit() {
  submitting.value = true;
  error.value = '';
  try {
    const key = `w-${Date.now()}`;
    await withdrawalApi.request(amount.value, key);
    await refreshNuxtData();
    amount.value = 0;
  } catch (e: any) {
    error.value = e?.data?.message ?? 'withdrawal_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Tarik Saldo — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Tarik Saldo</h1>
    <p v-if="earnings">Tersedia: <strong>{{ earnings.available }} {{ earnings.currency }}</strong></p>
    <p v-if="earnings">Tertahan: <strong>{{ earnings.pending }} {{ earnings.currency }}</strong></p>

    <form @submit.prevent="submit">
      <label>Jumlah <input v-model.number="amount" type="number" min="1000" required /></label>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Mengirim…' : 'Tarik' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <section>
      <h2>Riwayat Penarikan</h2>
      <ul>
        <li v-for="w in history" :key="w.id">
          {{ w.amount }} {{ w.currency }} — status: {{ w.status }}
        </li>
      </ul>
    </section>
  </main>
</template>