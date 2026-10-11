<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { sandboxApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Skenario Latihan — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

interface Entry {
  debitAccount: string;
  creditAccount: string;
  amount: number | null;
  memo: string;
}

const route = useRoute();
const scenarioId = computed(() => String(route.params.id || ''));

const { data: scenarios, status, error, refresh } = useAsyncData('sandbox:scenarios', () => sandboxApi.listScenarios(), { lazy: true });
const scenario = computed(() => scenarios.value?.find((item) => item.id === scenarioId.value) ?? null);

const entries = ref<Entry[]>([{ debitAccount: '', creditAccount: '', amount: null, memo: '' }]);
const validation = ref<{ isBalanced: boolean; score?: number; errors?: Array<{ code: string; message: string }> } | null>(null);
const submitting = ref(false);
const problem = ref<string | null>(null);

const total = computed(() => entries.value.reduce((sum, entry) => sum + (entry.amount ?? 0), 0));

function addEntry() {
  entries.value.push({ debitAccount: '', creditAccount: '', amount: null, memo: '' });
}

function removeEntry(index: number) {
  entries.value.splice(index, 1);
}

async function validate() {
  if (submitting.value) return;
  const filled = entries.value.filter((entry) => entry.debitAccount.trim() && entry.creditAccount.trim() && (entry.amount ?? 0) > 0);
  if (filled.length === 0) {
    problem.value = 'Isi minimal satu baris dengan akun debit, akun kredit, dan jumlah.';
    return;
  }
  submitting.value = true;
  problem.value = null;
  validation.value = null;
  try {
    const result = await sandboxApi.validateJournal({
      scenarioId: scenarioId.value,
      entries: filled.map((entry) => ({
        debitAccount: entry.debitAccount.trim(),
        creditAccount: entry.creditAccount.trim(),
        amount: entry.amount as number,
        ...(entry.memo.trim() ? { memo: entry.memo.trim() } : {}),
      })),
    });
    validation.value = (result as unknown as typeof validation.value) ?? null;
    if (!validation.value) problem.value = 'Validasi tidak mengembalikan hasil. Coba lagi.';
  } catch (err) {
    problem.value = describeApiError(err, 'Validasi gagal. Coba lagi.');
  } finally {
    submitting.value = false;
  }
}

useHead({ title: () => (scenario.value ? `${scenario.value.title} — ReduCera` : 'Skenario Latihan — ReduCera') });
</script>

<template>
  <div class="rc-stack">
    <LoadingSkeleton v-if="status === 'pending' && !scenarios" variant="panel" :count="2" />
    <ErrorState v-else-if="error" title="Skenario gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />
    <ErrorState v-else-if="!scenario" title="Skenario tidak ditemukan" message="Skenario ini tidak tersedia untuk levelmu." />

    <template v-else>
      <PageHeader :title="scenario.title" :subtitle="scenario.description ?? undefined">
        <template #actions>
          <PlayButton to="/sandbox" variant="outline" size="sm">Semua skenario</PlayButton>
        </template>
      </PageHeader>

      <PlayCard as="form" class="rc-studio-form" aria-label="Jurnal" novalidate @submit.prevent="validate">
        <h2 class="rc-h2">Entri jurnal</h2>
        <div v-for="(entry, index) in entries" :key="index" class="rc-sandbox__row">
          <label class="rc-label">
            Akun debit
            <input v-model="entry.debitAccount" class="rc-field" :aria-label="`Akun debit baris ${index + 1}`" />
          </label>
          <label class="rc-label">
            Akun kredit
            <input v-model="entry.creditAccount" class="rc-field" :aria-label="`Akun kredit baris ${index + 1}`" />
          </label>
          <label class="rc-label">
            Jumlah (Rp)
            <input v-model.number="entry.amount" type="number" min="0" class="rc-field" :aria-label="`Jumlah baris ${index + 1}`" />
          </label>
          <PlayButton v-if="entries.length > 1" variant="ghost" size="sm" :aria-label="`Hapus baris ${index + 1}`" @click="removeEntry(index)">Hapus</PlayButton>
        </div>
        <div class="rc-actions">
          <PlayButton variant="secondary" size="sm" @click="addEntry">Tambah baris</PlayButton>
          <span class="rc-hint">Total: {{ total.toLocaleString('id-ID') }}</span>
        </div>
        <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>
        <div class="rc-actions">
          <PlayButton type="submit" :loading="submitting">Periksa jurnal</PlayButton>
        </div>
      </PlayCard>

      <PlayCard v-if="validation" :tone="validation.isBalanced ? 'success' : 'danger'" as="section" aria-label="Hasil pemeriksaan" role="status">
        <h2 class="rc-h2">{{ validation.isBalanced ? 'Jurnal seimbang' : 'Jurnal belum seimbang' }}</h2>
        <p v-if="validation.score !== undefined">Skor: {{ Math.round(validation.score * 100) }}%</p>
        <ul v-if="validation.errors?.length">
          <li v-for="item in validation.errors" :key="item.code">{{ item.message }}</li>
        </ul>
      </PlayCard>
    </template>
  </div>
</template>
