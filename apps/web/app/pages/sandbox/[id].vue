<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import ProgressBar from '~/components/charts/ProgressBar.vue';
import { sandboxApi, personalizationApi } from '~/lib/api';

const route = useRoute();
const scenarioId = String(route.params.id || '');

const scenario = ref<any>(null);
const entries = ref<Array<{ debitAccount: string; creditAccount: string; amount: number; memo?: string }>>([]);
const validation = ref<{ isBalanced: boolean; score?: number; errors?: Array<{ code: string; message: string }> } | null>(null);
const submitting = ref(false);
const error = ref('');

const total = computed(() => entries.value.reduce((s, e) => s + (e.amount || 0), 0));

async function loadScenario() {
  try {
    const scenarios = (await sandboxApi.listScenarios()) as Array<any>;
    scenario.value = scenarios.find((s) => s.id === scenarioId);
  } catch {
    scenario.value = null;
  }
}

function addEntry() {
  entries.value.push({ debitAccount: 'Cash', creditAccount: 'ServiceRevenue', amount: 0 });
}

function removeEntry(i: number) {
  entries.value.splice(i, 1);
}

async function validate() {
  if (entries.value.length === 0) {
    error.value = 'Tambahkan minimal 1 entry';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const result = (await sandboxApi.validateJournal({ scenarioId, entries: entries.value })) as any;
    validation.value = result;
  } catch (e: any) {
    error.value = e?.data?.message || 'Validasi gagal';
  } finally {
    submitting.value = false;
  }
}

const props = defineProps<{ id?: string }>();
if (props.id) {
  loadScenario();
}
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-6">
    <NuxtLink to="/sandbox" class="text-sm text-[var(--rc-primary,#3b82f6)]">← Kembali ke daftar skenario</NuxtLink>
    <div v-if="scenario">
      <h1 class="text-3xl font-bold">{{ scenario.title }}</h1>
      <p class="text-[var(--rc-fg-muted,#6b7280)] mt-1">{{ scenario.description }}</p>
      <div class="mt-2 text-sm">Tingkat kesulitan: <strong>{{ scenario.difficulty }}</strong> · Level {{ scenario.level }}</div>
    </div>

    <section class="bg-[var(--rc-bg,#fff)] rounded-lg border border-[var(--rc-border)] p-4 space-y-3">
      <h2 class="font-semibold">Entry Jurnal Anda</h2>
      <div v-for="(e, i) in entries" :key="i" class="grid grid-cols-4 gap-2 items-center">
        <input v-model="e.debitAccount" placeholder="Akun debit" class="px-2 py-1.5 rounded border" />
        <input v-model="e.creditAccount" placeholder="Akun kredit" class="px-2 py-1.5 rounded border" />
        <input v-model.number="e.amount" type="number" placeholder="Jumlah" class="px-2 py-1.5 rounded border" />
        <button type="button" class="text-red-600 text-sm" @click="removeEntry(i)">×</button>
      </div>
      <div class="flex justify-between items-center pt-2">
        <button type="button" class="text-sm text-[var(--rc-primary,#3b82f6)]" @click="addEntry">+ Tambah entry</button>
        <span class="text-xs">Total debit/kredit: {{ total.toLocaleString() }}</span>
      </div>
    </section>

    <div v-if="error" class="bg-red-50 text-red-700 px-3 py-2 rounded">{{ error }}</div>

    <div class="flex gap-2">
      <button type="button" class="bg-[var(--rc-primary,#3b82f6)] text-white px-4 py-2 rounded font-medium" :disabled="submitting" @click="validate">
        {{ submitting ? 'Memvalidasi…' : 'Validasi Jurnal' }}
      </button>
    </div>

    <div v-if="validation" class="space-y-2">
      <div :class="['p-3 rounded', validation.isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700']">
        <strong>{{ validation.isBalanced ? '✓ Seimbang!' : '✗ Tidak Seimbang' }}</strong>
        <span v-if="validation.score !== undefined"> · Skor: {{ Math.round(validation.score * 100) }}%</span>
      </div>
      <ul v-if="validation.errors && validation.errors.length" class="space-y-1 text-sm">
        <li v-for="e in validation.errors" :key="e.code" class="text-red-700">- {{ e.message }}</li>
      </ul>
    </div>
  </main>
</template>