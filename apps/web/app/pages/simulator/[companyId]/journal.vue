<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import { simulatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Jurnal Simulasi — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Jurnal Simulasi — ReduCera' });

const route = useRoute();
const companyId = computed(() => String(route.params.companyId));

const { data: entries, refresh } = useAsyncData(() => `simulator:entries:${companyId.value}`, () => simulatorApi.listEntries(companyId.value), {
  lazy: true,
  watch: [companyId],
});

const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  debitAccount: '',
  creditAccount: '',
  amount: null as number | null,
  memo: '',
});

const adding = ref(false);
const problem = ref<string | null>(null);

async function add() {
  if (adding.value) return;
  if (!form.debitAccount.trim() || !form.creditAccount.trim() || !form.amount || form.amount <= 0) {
    problem.value = 'Isi akun debit, akun kredit, dan jumlah lebih dari nol.';
    return;
  }
  adding.value = true;
  problem.value = null;
  try {
    await simulatorApi.addEntry(companyId.value, {
      date: form.date,
      debitAccount: form.debitAccount.trim(),
      creditAccount: form.creditAccount.trim(),
      amount: form.amount,
      ...(form.memo.trim() ? { memo: form.memo.trim() } : {}),
    });
    form.debitAccount = '';
    form.creditAccount = '';
    form.amount = null;
    form.memo = '';
    await refresh();
  } catch (err) {
    problem.value = describeApiError(err, 'Jurnal gagal ditambahkan. Coba lagi.');
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Jurnal simulasi" subtitle="Catat transaksi perusahaan simulasi, satu per satu.">
      <template #actions>
        <PlayButton :to="`/simulator/${companyId}`" variant="secondary" size="sm">Lihat laporan</PlayButton>
      </template>
    </PageHeader>

    <PlayCard as="form" class="rc-studio-form" aria-label="Tambah jurnal" novalidate @submit.prevent="add">
      <div class="rc-studio-form__row">
        <label class="rc-label">
          Tanggal
          <input v-model="form.date" type="date" required class="rc-field" />
        </label>
        <label class="rc-label">
          Akun debit
          <input v-model="form.debitAccount" class="rc-field" />
        </label>
        <label class="rc-label">
          Akun kredit
          <input v-model="form.creditAccount" class="rc-field" />
        </label>
        <label class="rc-label">
          Jumlah (Rp)
          <input v-model.number="form.amount" type="number" min="0" class="rc-field" />
        </label>
      </div>
      <label class="rc-label">
        Memo (opsional)
        <input v-model="form.memo" class="rc-field" maxlength="200" />
      </label>
      <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>
      <div class="rc-actions">
        <PlayButton type="submit" :loading="adding">Tambah jurnal</PlayButton>
      </div>
    </PlayCard>

    <EmptyState v-if="!entries || entries.length === 0" title="Belum ada jurnal" message="Tambahkan transaksi pertama di atas." />
    <div v-else class="rc-table-wrap">
      <table class="rc-table">
        <caption>Jurnal simulasi</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Debit</th>
            <th scope="col">Kredit</th>
            <th scope="col" class="rc-table__num">Jumlah</th>
            <th scope="col">Memo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td>{{ entry.date }}</td>
            <td>{{ entry.debitAccount }}</td>
            <td>{{ entry.creditAccount }}</td>
            <td class="rc-table__num">{{ formatMoney(entry.amount) }}</td>
            <td>{{ entry.memo }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
