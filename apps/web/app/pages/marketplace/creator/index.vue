<script setup lang="ts">
interface ConceptDiagnostic {
  conceptKey: string;
  totalAttempts: number;
  totalFailures: number;
  failureRate: number;
  lastAttemptAt: string | null;
  exampleSubTopicIds: string[];
}

interface CreatorDiagnostics {
  totalLearners: number;
  activeLearners: number;
  concepts: ConceptDiagnostic[];
  strugglingConcepts: ConceptDiagnostic[];
  summary: string;
}

const user = useState<{ id: string; role: string } | null>('user');
const route = useRoute();
const diagnostics = ref<CreatorDiagnostics | null>(null);
const error = ref<string | null>(null);

const creatorId = computed(() => (route.params.id as string) || user.value?.id);

async function load() {
  if (!creatorId.value) return;
  try {
    const res = await $fetch<{ data: CreatorDiagnostics }>(
      `/v1/creator-analytics/${creatorId.value}/diagnostics`,
    );
    diagnostics.value = res.data;
  } catch (err) {
    error.value = 'Tidak bisa memuat analitik kreator.';
    console.error(err);
  }
}

onMounted(load);

useHead({
  title: 'Dashboard Kreator | ReduCera',
});
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-6xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <header class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold" :style="{ color: 'var(--rc-fg)' }">
        Dashboard Kreator
      </h1>
      <p class="mt-2" :style="{ color: 'var(--rc-muted)' }">
        Statistik pembelajaran untuk materi Anda dalam 7 hari terakhir.
      </p>
    </header>

    <div v-if="error" class="p-4 rounded-md" :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-fg)' }">
      {{ error }}
    </div>

    <div v-if="diagnostics" class="space-y-8">
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Total Mahasiswa</p>
          <p class="mt-2 text-3xl font-bold">{{ diagnostics.totalLearners }}</p>
        </div>
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Mahasiswa Aktif (7 hari)</p>
          <p class="mt-2 text-3xl font-bold">{{ diagnostics.activeLearners }}</p>
        </div>
        <div class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
          <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">Konsep Sulit</p>
          <p class="mt-2 text-3xl font-bold">{{ diagnostics.strugglingConcepts.length }}</p>
        </div>
      </section>

      <section class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-foam)', border: '1px solid var(--rc-border)' }">
        <h2 class="text-lg font-semibold mb-2" :style="{ color: 'var(--rc-fg)' }">Ringkasan</h2>
        <p :style="{ color: 'var(--rc-fg)' }">{{ diagnostics.summary }}</p>
      </section>

      <section v-if="diagnostics.strugglingConcepts.length > 0">
        <h2 class="text-xl font-semibold mb-4" :style="{ color: 'var(--rc-fg)' }">Konsep Paling Sulit</h2>
        <ul class="space-y-3">
          <li
            v-for="c in diagnostics.strugglingConcepts"
            :key="c.conceptKey"
            class="p-4 rounded-lg"
            :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }"
          >
            <div class="flex items-baseline justify-between">
              <code class="text-sm font-mono" :style="{ color: 'var(--rc-primary)' }">{{ c.conceptKey }}</code>
              <span class="text-xs" :style="{ color: 'var(--rc-muted)' }">
                {{ c.totalFailures }} / {{ c.totalAttempts }} gagal
              </span>
            </div>
            <div class="mt-2 h-2 rounded overflow-hidden" :style="{ backgroundColor: 'var(--rc-foam)' }">
              <div
                class="h-full"
                :style="{
                  width: `${(c.failureRate * 100).toFixed(0)}%`,
                  backgroundColor: c.failureRate > 0.7 ? 'var(--rc-accent)' : 'var(--rc-primary)',
                }"
              ></div>
            </div>
            <p class="mt-2 text-xs" :style="{ color: 'var(--rc-muted)' }">
              {{ (c.failureRate * 100).toFixed(0) }}% mahasiswa gagal memahami konsep ini
            </p>
          </li>
        </ul>
      </section>

      <section v-else>
        <p :style="{ color: 'var(--rc-muted)' }">Tidak ada konsep dengan tingkat kegagalan >= 50% minggu ini. Bagus!</p>
      </section>
    </div>

    <div v-else class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat analitik…</p>
    </div>
  </div>
</template>
