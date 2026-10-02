<script setup lang="ts">
import { ref } from 'vue';
import type { SandboxJournalEntry, SandboxJournalValidation } from '~/interfaces/sandbox';
import { sandboxApi } from '~/lib/api';

const props = defineProps<{
  scenarioId: string;
}>();

const entries = ref<SandboxJournalEntry[]>([
  { debitAccount: '', creditAccount: '', amount: 0 },
]);

const validation = ref<SandboxJournalValidation | null>(null);
const submitting = ref(false);

function addRow() {
  entries.value.push({ debitAccount: '', creditAccount: '', amount: 0 });
}

function removeRow(index: number) {
  entries.value.splice(index, 1);
}

async function submit() {
  submitting.value = true;
  try {
    validation.value = (await sandboxApi.validateJournal({
      scenarioId: props.scenarioId,
      entries: entries.value.filter(
        (entry) => entry.debitAccount && entry.creditAccount && entry.amount > 0,
      ),
    })) ?? null;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <div v-for="(entry, index) in entries" :key="index" class="entry-row">
      <input v-model="entry.debitAccount" placeholder="Akun debit" />
      <input v-model="entry.creditAccount" placeholder="Akun kredit" />
      <input v-model.number="entry.amount" type="number" placeholder="Jumlah" min="0" />
      <button type="button" @click="removeRow(index)">Hapus</button>
    </div>
    <button type="button" @click="addRow">Tambah baris</button>
    <button type="submit" :disabled="submitting">
      {{ submitting ? 'Memvalidasi…' : 'Validasi Jurnal' }}
    </button>
  </form>

  <section v-if="validation" :class="`result ${validation.isBalanced ? 'balanced' : 'unbalanced'}`">
    <strong>{{ validation.isBalanced ? 'Seimbang!' : 'Tidak seimbang' }}</strong>
    <p v-if="validation.score !== undefined">Skor: {{ validation.score }}</p>
    <ul v-if="validation.errors && validation.errors.length">
      <li v-for="error in validation.errors" :key="error.code">{{ error.message }}</li>
    </ul>
  </section>
</template>