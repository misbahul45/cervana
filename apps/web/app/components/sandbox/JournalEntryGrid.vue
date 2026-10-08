<script setup lang="ts">
import { computed, ref } from 'vue';

interface Line {
  id: string;
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
}

interface ValidationResult {
  accepted: boolean;
  perLineErrors: Map<string, string>;
  balanceInfo: string;
  ruleErrors: string[];
}

const props = defineProps<{
  accountCatalog?: Record<string, { type: string; normalBalance: 'DEBIT' | 'CREDIT' }>;
  periodOpen?: boolean;
  validate?: (lines: Line[]) => ValidationResult;
}>();

const lines = ref<Line[]>([
  { id: crypto.randomUUID(), accountCode: '1000', direction: 'DEBIT', amount: 0 },
  { id: crypto.randomUUID(), accountCode: '1010', direction: 'CREDIT', amount: 0 },
]);

function addLine() {
  lines.value.push({ id: crypto.randomUUID(), accountCode: '', direction: 'DEBIT', amount: 0 });
}

function removeLine(id: string) {
  lines.value = lines.value.filter(l => l.id !== id);
}

const totalDebit = computed(() => lines.value.filter(l => l.direction === 'DEBIT').reduce((s, l) => s + (l.amount || 0), 0));
const totalCredit = computed(() => lines.value.filter(l => l.direction === 'CREDIT').reduce((s, l) => s + (l.amount || 0), 0));

const validation = computed<ValidationResult>(() => {
  if (props.validate) return props.validate(lines.value);
  const perLineErrors = new Map<string, string>();
  for (const line of lines.value) {
    if (!line.accountCode) {
      perLineErrors.set(line.id, 'Akun belum dipilih');
      continue;
    }
    const acc = props.accountCatalog?.[line.accountCode];
    if (!acc) {
      perLineErrors.set(line.id, `Akun ${line.accountCode} tidak dikenal`);
      continue;
    }
    if (line.direction !== acc.normalBalance) {
      perLineErrors.set(line.id, `Normal balance ${acc.normalBalance} untuk akun ${acc.type}`);
    }
    if (line.amount <= 0) {
      perLineErrors.set(line.id, 'Jumlah harus > 0');
    }
  }
  const balance = Math.abs(totalDebit.value - totalCredit.value) < 0.01;
  const balanceErr = balance ? '' : `Σ debit (${totalDebit.value.toFixed(2)}) ≠ Σ credit (${totalCredit.value.toFixed(2)})`;
  const periodErr = props.periodOpen === false ? 'Periode tertutup' : '';
  const accepted = perLineErrors.size === 0 && balance && periodErr === '';
  return {
    accepted,
    perLineErrors,
    balanceInfo: balanceErr,
    ruleErrors: [periodErr].filter(Boolean),
  };
});

function submit() {
  if (!validation.value.accepted) return;
  emit('submit', lines.value);
}

const emit = defineEmits<{ submit: [Line[]] }>();
</script>

<template>
  <section class="rc-journal-entry-grid" aria-labelledby="journal-heading">
    <h2 id="journal-heading">Jurnal Umum</h2>
    <p class="rc-journal-entry-grid__disclaimer">
      Simulasi untuk belajar; bukan nasihat akuntansi profesional.
    </p>

    <table class="rc-journal-entry-grid__table" aria-label="Entri jurnal">
      <thead>
        <tr>
          <th scope="col">Akun</th>
          <th scope="col">Debit</th>
          <th scope="col">Credit</th>
          <th scope="col">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.id">
          <td>
            <select v-model="line.accountCode" :aria-label="`Akun baris ${line.id}`">
              <option value="">— pilih akun —</option>
              <option
                v-for="(acc, code) in (accountCatalog || {})"
                :key="code"
                :value="code"
              >
                {{ code }} — {{ acc.type }}
              </option>
            </select>
          </td>
          <td>
            <input
              v-model.number="line.amount"
              type="number"
              min="0"
              step="0.01"
              :disabled="line.direction !== 'DEBIT'"
              :aria-label="`Jumlah debit baris ${line.id}`"
            />
          </td>
          <td>
            <input
              v-model.number="line.amount"
              type="number"
              min="0"
              step="0.01"
              :disabled="line.direction !== 'CREDIT'"
              :aria-label="`Jumlah credit baris ${line.id}`"
            />
          </td>
          <td>
            <select v-model="line.direction" :aria-label="`Arah baris ${line.id}`">
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <button
              type="button"
              class="rc-journal-entry-grid__remove"
              :aria-label="`Hapus baris ${line.id}`"
              @click="removeLine(line.id)"
            >
              ×
            </button>
          </td>
        </tr>
        <tr v-for="(line, idx) in lines" :key="`err-${line.id}`" class="rc-journal-entry-grid__err">
          <td colspan="4">
            <span
              v-if="validation.perLineErrors.get(line.id)"
              role="alert"
            >
              ⚠ {{ validation.perLineErrors.get(line.id) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <button type="button" class="rc-journal-entry-grid__add" @click="addLine">
      + Tambah baris
    </button>

    <DebitCreditTotal :debit="totalDebit" :credit="totalCredit" />

    <div v-if="!validation.balanceInfo" class="rc-journal-entry-grid__validation-ok">
      Σ debit = Σ credit — entri siap di-posting.
    </div>
    <div v-else class="rc-journal-entry-grid__validation-error" role="alert">
      ⚠ {{ validation.balanceInfo }}
    </div>

    <div v-if="validation.ruleErrors.length" class="rc-journal-entry-grid__validation-error" role="alert">
      <p v-for="err in validation.ruleErrors" :key="err">⚠ {{ err }}</p>
    </div>

    <button
      type="button"
      class="rc-journal-entry-grid__post"
      :disabled="!validation.accepted"
      @click="submit"
    >
      Posting jurnal
    </button>
  </section>
</template>

<style scoped>
.rc-journal-entry-grid { display: flex; flex-direction: column; gap: 1rem; }
.rc-journal-entry-grid__disclaimer {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-journal-entry-grid__table { width: 100%; border-collapse: collapse; }
.rc-journal-entry-grid__table th,
.rc-journal-entry-grid__table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  text-align: left;
}
.rc-journal-entry-grid__table select,
.rc-journal-entry-grid__table input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
}
.rc-journal-entry-grid__remove {
  margin-left: 0.5rem;
  background: transparent;
  border: 0;
  color: var(--ui-text-muted);
  cursor: pointer;
  font-size: 1rem;
}
.rc-journal-entry-grid__err span {
  display: block;
  color: #b91c1c;
  font-size: 0.875rem;
}
.rc-journal-entry-grid__add {
  align-self: flex-start;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px dashed var(--ui-border, rgba(0, 0, 0, 0.15));
  background: transparent;
  cursor: pointer;
}
.rc-journal-entry-grid__validation-ok {
  color: #16a34a;
  font-weight: 600;
}
.rc-journal-entry-grid__validation-error {
  color: #b91c1c;
}
.rc-journal-entry-grid__post {
  align-self: flex-start;
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
.rc-journal-entry-grid__post:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>