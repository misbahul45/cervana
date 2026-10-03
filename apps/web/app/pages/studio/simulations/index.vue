<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import Form from '~/components/ui/Form.vue';

const router = useRouter();

const form = reactive({
  title: '',
  description: '',
  topicId: '',
  durationMinutes: 60,
  capacity: 30,
  config: { type: 'multi_period', periods: [] as Array<{ label: string; date: string; entries: Array<{ debitAccount: string; creditAccount: string; amount: number }> }> },
});

const submitting = ref(false);
const error = ref('');

const total = computed(() => form.config.periods.reduce((s, p) => s + p.entries.reduce((ss, e) => ss + (e.amount || 0), 0), 0));

function addPeriod() {
  form.config.periods.push({ label: `Periode ${form.config.periods.length + 1}`, date: '', entries: [{ debitAccount: 'Cash', creditAccount: 'ServiceRevenue', amount: 0 }] });
}

function removePeriod(i: number) {
  form.config.periods.splice(i, 1);
}

function addEntry(periodIdx: number) {
  form.config.periods[periodIdx].entries.push({ debitAccount: 'Cash', creditAccount: 'ServiceRevenue', amount: 0 });
}

function removeEntry(periodIdx: number, entryIdx: number) {
  form.config.periods[periodIdx].entries.splice(entryIdx, 1);
}

async function save() {
  if (!form.title || form.config.periods.length === 0) {
    error.value = 'Judul dan minimal 1 periode wajib diisi';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    await router.push('/studio/simulations');
  } catch (e: any) {
    error.value = e?.data?.message || 'Gagal';
  } finally {
    submitting.value = false;
  }
}

function fields() {
  return [
    { name: 'title', label: 'Judul Simulasi', type: 'text', required: true },
    { name: 'topicId', label: 'Topik', type: 'text', required: true },
    { name: 'durationMinutes', label: 'Durasi (menit)', type: 'number', required: true },
  ];
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Simulasi</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Buat simulasi multi-periode. Total debit/kredit harus seimbang untuk neraca.</p>

    <div v-if="error" class="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200">{{ error }}</div>

    <Form :fields="fields()" @submit="(d) => Object.assign(form, d) && save()" submit-label="Simpan" />

    <div>
      <div class="flex justify-between items-center mb-2">
        <label class="font-medium">Periode ({{ form.config.periods.length }})</label>
        <span class="text-sm">Total: <strong>{{ total.toLocaleString() }}</strong></span>
      </div>
      <div v-for="(p, i) in form.config.periods" :key="i" class="border border-[var(--rc-border)] rounded p-3 mb-3 space-y-2">
        <div class="flex gap-2">
          <input v-model="p.label" placeholder="Label periode" class="flex-1 px-3 py-2 rounded border border-[var(--rc-border)]" />
          <input v-model="p.date" type="date" class="px-3 py-2 rounded border border-[var(--rc-border)]" />
          <button type="button" class="text-red-600" @click="removePeriod(i)">×</button>
        </div>
        <div v-for="(e, j) in p.entries" :key="j" class="flex gap-2 items-center">
          <input v-model="e.debitAccount" placeholder="Akun debit" class="flex-1 px-2 py-1 rounded border" />
          <input v-model="e.creditAccount" placeholder="Akun kredit" class="flex-1 px-2 py-1 rounded border" />
          <input v-model.number="e.amount" type="number" placeholder="Jumlah" class="w-24 px-2 py-1 rounded border" />
          <button type="button" class="text-red-600" @click="removeEntry(i, j)">×</button>
        </div>
        <button type="button" class="text-sm text-[var(--rc-primary,#3b82f6)]" @click="addEntry(i)">+ Tambah entry</button>
      </div>
      <button type="button" class="text-sm text-[var(--rc-primary,#3b82f6)]" @click="addPeriod">+ Tambah periode</button>
    </div>
  </main>
</template>