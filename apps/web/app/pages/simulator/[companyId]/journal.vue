<script setup lang="ts">
import { computed, ref } from 'vue';
import { simulatorApi } from '~/lib/api';

const route = useRoute();
const companyId = computed(() => String(route.params.companyId));
const entries = ref<any[]>([]);

async function load() {
  try {
    entries.value = (await simulatorApi.listEntries(companyId.value)) ?? [];
  } catch {
    entries.value = [];
  }
}

await load();

const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  debitAccount: '',
  creditAccount: '',
  amount: 0,
  memo: '',
});

async function add() {
  await simulatorApi.addEntry(companyId.value, form);
  await load();
}

useHead({ title: 'Jurnal Simulasi — ReduCera' });
</script>

<template>
  <main>
    <h1>Jurnal Simulasi</h1>
    <form @submit.prevent="add">
      <input v-model="form.date" type="date" required />
      <input v-model="form.debitAccount" placeholder="Akun debit" required />
      <input v-model="form.creditAccount" placeholder="Akun kredit" required />
      <input v-model.number="form.amount" type="number" min="0" required />
      <input v-model="form.memo" placeholder="Memo (opsional)" />
      <button type="submit">Tambah</button>
    </form>

    <table>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Debit</th>
          <th>Kredit</th>
          <th>Jumlah</th>
          <th>Memo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id">
          <td>{{ e.date }}</td>
          <td>{{ e.debitAccount }}</td>
          <td>{{ e.creditAccount }}</td>
          <td>{{ e.amount }}</td>
          <td>{{ e.memo }}</td>
        </tr>
      </tbody>
    </table>

    <NuxtLink :to="`/simulator/${companyId.value}`">Lihat laporan</NuxtLink>
  </main>
</template>