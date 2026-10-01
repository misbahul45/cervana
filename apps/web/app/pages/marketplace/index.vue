<script setup lang="ts">
import type { Recommendation } from '~/interfaces/marketplace/discovery';

useHead({
  title: 'Marketplace Belajar Akuntansi | ReduCera',
});

const user = useState<{ id: string } | null>('user');
const recommendations = ref<Recommendation[]>([]);
const summary = ref<{ averageMastery: number; preferredDifficulty: string } | null>(null);
const error = ref<string | null>(null);

async function load() {
  if (!user.value) return;
  try {
    const res = await $fetch<{ data: { recommendations: Recommendation[]; averageMastery: number; preferredDifficulty: string } }>(
      '/v1/marketplace-discovery/recommendations?limit=12',
    );
    recommendations.value = res.data.recommendations;
    summary.value = {
      averageMastery: res.data.averageMastery,
      preferredDifficulty: res.data.preferredDifficulty,
    };
  } catch (err) {
    error.value = 'Tidak bisa memuat rekomendasi. Coba lagi.';
    console.error(err);
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-7xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <header class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold" :style="{ color: 'var(--rc-fg)' }">
        Marketplace Belajar Akuntansi
      </h1>
      <p v-if="summary" class="mt-2 text-base" :style="{ color: 'var(--rc-muted)' }">
        Mastery rata-rata {{ (summary.averageMastery * 100).toFixed(0) }}%. Rekomendasi difilter untuk level {{ summary.preferredDifficulty.toLowerCase() }}.
      </p>
      <p v-else class="mt-2" :style="{ color: 'var(--rc-muted)' }">
        Rekomendasi belajar yang sesuai dengan cara belajarmu.
      </p>
    </header>

    <div v-if="error" class="p-4 rounded-md" :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-fg)' }">
      {{ error }}
    </div>

    <div v-if="!user" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Masuk dulu untuk melihat rekomendasi.</p>
      <UButton to="/login" color="primary" class="mt-4">Masuk</UButton>
    </div>

    <div v-else-if="recommendations.length === 0 && !error" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Belum ada rekomendasi. Coba lagi nanti atau kerjakan beberapa lesson dulu.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <article
        v-for="rec in recommendations"
        :key="rec.product.id"
        class="p-6 rounded-xl transition-shadow"
        :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)', color: 'var(--rc-fg)' }"
      >
        <header class="flex items-start justify-between gap-3">
          <div>
            <span
              class="inline-block px-2 py-0.5 text-xs rounded-full uppercase tracking-wide mb-2"
              :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-primary)' }"
            >
              {{ rec.product.kind === 'article' ? 'Materi' : 'Kelas' }}
            </span>
            <h2 class="text-lg font-semibold leading-snug">{{ rec.product.title }}</h2>
          </div>
          <span :style="{ color: 'var(--rc-muted)' }" class="text-sm font-mono">
            {{ Math.round(rec.score * 100) }}%
          </span>
        </header>

        <p class="mt-3 text-sm leading-relaxed" :style="{ color: 'var(--rc-muted)' }">
          {{ rec.reason }}
        </p>

        <dl class="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt :style="{ color: 'var(--rc-muted)' }">Tujuan</dt>
            <dd class="font-mono">{{ Math.round(rec.signals.matchesGoal * 100) }}%</dd>
          </div>
          <div>
            <dt :style="{ color: 'var(--rc-muted)' }">Level</dt>
            <dd class="font-mono">{{ Math.round(rec.signals.matchesDifficulty * 100) }}%</dd>
          </div>
          <div>
            <dt :style="{ color: 'var(--rc-muted)' }">Prasyarat</dt>
            <dd class="font-mono">{{ Math.round(rec.signals.matchesPrerequisites * 100) }}%</dd>
          </div>
        </dl>

        <footer class="mt-5 flex items-center justify-between">
          <span class="text-sm font-mono">
            {{ rec.product.accessType === 'FREE' ? 'Gratis' : `Rp ${(rec.product.price ?? 0).toLocaleString('id-ID')}` }}
          </span>
          <UButton
            :to="rec.product.kind === 'article' ? `/marketplace/articles/${rec.product.slug}` : `/marketplace/classes/${rec.product.slug}`"
            color="primary"
            size="sm"
          >
            Buka
          </UButton>
        </footer>
      </article>
    </div>
  </div>
</template>
