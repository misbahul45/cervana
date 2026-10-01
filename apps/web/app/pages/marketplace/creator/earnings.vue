<script setup lang="ts">
interface CreatorEarning {
  id: string;
  amount: number;
  currency: string;
  source: string;
  createdAt: string;
  paidOut: boolean;
}

interface EarningSummary {
  totalEarned: number;
  pendingPayout: number;
  lifetimeEarnings: number;
  recent: CreatorEarning[];
}

const user = useState<{ id: string; role: string } | null>('user');
const summary = ref<EarningSummary | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);

async function load() {
  if (!user.value || user.value.role !== 'TEACHER') {
    loading.value = false;
    return;
  }
  try {
    const res = await $fetch<{ data: EarningSummary }>(`/v1/creator-analytics/${user.value.id}/earnings`);
    summary.value = res.data;
  } catch (err) {
    error.value = 'Tidak bisa memuat data penghasilan.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

useHead({
  title: 'Penghasilan Kreator | ReduCera',
});
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-5xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <header class="mb-8">
      <h1 class="text-3xl font-bold" :style="{ color: 'var(--rc-fg)' }">Penghasilan Kreator</h1>
      <p class="mt-1 text-sm" :style="{ color: 'var(--rc-muted)' }">Pendapatan dari materi dan kelas Anda.</p>
    </header>

    <div v-if="user?.role !== 'TEACHER'" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Halaman ini hanya untuk kreator (TEACHER role).</p>
    </div>

    <div v-else-if="error" class="p-4 rounded-md" :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-fg)' }">
      {{ error }}
    </div>

    <div v-else-if="loading" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat…</p>
    </div>

    <template v-else-if="summary">
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Pending Payout</p>
          <p class="mt-2 text-2xl font-mono">Rp {{ summary.pendingPayout.toLocaleString('id-ID') }}</p>
        </div>
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Lifetime Earnings</p>
          <p class="mt-2 text-2xl font-mono">Rp {{ summary.lifetimeEarnings.toLocaleString('id-ID') }}</p>
        </div>
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Recent</p>
          <p class="mt-2 text-2xl font-mono">Rp {{ summary.totalEarned.toLocaleString('id-ID') }}</p>
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-xl font-semibold mb-3" :style="{ color: 'var(--rc-fg)' }">Penghasilan Terbaru</h2>
        <div v-if="summary.recent.length === 0" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p :style="{ color: 'var(--rc-muted)' }">Belum ada penghasilan.</p>
        </div>
        <table v-else class="w-full">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">
              <th class="py-2">Tanggal</th>
              <th class="py-2">Sumber</th>
              <th class="py-2 text-right">Jumlah</th>
              <th class="py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in summary.recent" :key="e.id" class="border-t" :style="{ borderColor: 'var(--rc-border)' }">
              <td class="py-3 text-sm">{{ new Date(e.createdAt).toLocaleDateString('id-ID') }}</td>
              <td class="py-3 text-sm font-mono">{{ e.source }}</td>
              <td class="py-3 text-sm text-right font-mono">Rp {{ e.amount.toLocaleString('id-ID') }}</td>
              <td class="py-3 text-right text-xs" :style="{ color: e.paidOut ? 'var(--rc-primary)' : 'var(--rc-muted)' }">
                {{ e.paidOut ? 'PAID' : 'PENDING' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
