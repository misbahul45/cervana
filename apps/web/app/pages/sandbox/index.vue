<script setup lang="ts">
import { sandboxApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Sandbox Akuntansi — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const { data: scenarios, status, error, refresh } = useAsyncData('sandbox:scenarios', () => sandboxApi.listScenarios(), {
  lazy: true,
});
</script>

<template>
  <main id="main" aria-labelledby="sandbox-list-h">
    <h1 id="sandbox-list-h">Sandbox Akuntansi</h1>
    <p>Latih pencatatan jurnal Anda di skenario dunia nyata.</p>
    <p class="rc-sandbox-list__disclaimer">
      Simulasi untuk belajar; bukan nasihat akuntansi profesional.
    </p>

    <LoadingSkeleton v-if="status === 'pending'" variant="card" :count="3" />
    <ErrorState
      v-else-if="error"
      title="Gagal memuat skenario"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <EmptyState
      v-else-if="!scenarios || scenarios.length === 0"
      title="Belum ada skenario untuk levelmu"
      message="Mulai dari jalur belajar untuk membuka latihan pertama."
      cta-label="Buka peta keterampilan"
      cta-to="/learn/path"
    />
    <ul v-else class="rc-sandbox-list__grid">
      <li v-for="s in scenarios" :key="s.id">
        <SandboxScenarioCard
          :title="s.title"
          :description="s.description"
          :difficulty="s.difficulty"
          :prerequisite-label="`Level ${s.level}`"
          :to="`/sandbox/${s.id}`"
        />
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-sandbox-list__disclaimer {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  margin-bottom: 1rem;
}
.rc-sandbox-list__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
</style>