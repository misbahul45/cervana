<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { moderationApi } from '~/lib/api';

const articles = ref<any[]>([]);
const classes = ref<any[]>([]);
const loading = ref(true);
const acting = ref<string | null>(null);

async function load() {
  try {
    const data = (await moderationApi.listPending()) as any;
    articles.value = data?.articles || [];
    classes.value = data?.classes || [];
  } catch {
    articles.value = [];
    classes.value = [];
  } finally {
    loading.value = false;
  }
}

async function approve(kind: 'article' | 'class', id: string) {
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.approve(kind, id);
    await load();
  } finally {
    acting.value = null;
  }
}

async function reject(kind: 'article' | 'class', id: string) {
  const feedback = window.prompt('Alasan penolakan:');
  if (!feedback) return;
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.reject(kind, id, feedback);
    await load();
  } finally {
    acting.value = null;
  }
}

onMounted(load);
</script>

<template>
  <main class="max-w-5xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Antrian Moderasi</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Tinjau artikel dan kelas yang menunggu persetujuan.</p>

    <div v-if="loading" class="text-center py-8">Memuat...</div>

    <template v-else>
      <section>
        <h2 class="text-xl font-semibold mb-3">Artikel Menunggu ({{ articles.length }})</h2>
        <div v-if="articles.length === 0" class="text-center py-6 text-[var(--rc-fg-muted,#6b7280)] bg-[var(--rc-bg-elevated,#f9fafb)] rounded">Tidak ada antrian.</div>
        <div v-else class="space-y-2">
          <div v-for="a in articles" :key="a.id" class="bg-[var(--rc-bg,#fff)] rounded p-3 border border-[var(--rc-border)] flex items-center justify-between">
            <div>
              <strong>{{ a.title }}</strong>
              <div class="text-xs text-[var(--rc-fg-muted,#6b7280)]">{{ a.author?.email || a.authorId }}</div>
            </div>
            <div class="flex gap-2">
              <button type="button" class="px-3 py-1 rounded bg-green-600 text-white text-sm" :disabled="acting === `article:${a.id}`" @click="approve('article', a.id)">Setujui</button>
              <button type="button" class="px-3 py-1 rounded bg-red-600 text-white text-sm" :disabled="acting === `article:${a.id}`" @click="reject('article', a.id)">Tolak</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-xl font-semibold mb-3 mt-6">Kelas Menunggu ({{ classes.length }})</h2>
        <div v-if="classes.length === 0" class="text-center py-6 text-[var(--rc-fg-muted,#6b7280)] bg-[var(--rc-bg-elevated,#f9fafb)] rounded">Tidak ada antrian.</div>
        <div v-else class="space-y-2">
          <div v-for="c in classes" :key="c.id" class="bg-[var(--rc-bg,#fff)] rounded p-3 border border-[var(--rc-border)] flex items-center justify-between">
            <div>
              <strong>{{ c.title }}</strong>
              <div class="text-xs text-[var(--rc-fg-muted,#6b7280)]">{{ c.author?.email || c.authorId }}</div>
            </div>
            <div class="flex gap-2">
              <button type="button" class="px-3 py-1 rounded bg-green-600 text-white text-sm" :disabled="acting === `class:${c.id}`" @click="approve('class', c.id)">Setujui</button>
              <button type="button" class="px-3 py-1 rounded bg-red-600 text-white text-sm" :disabled="acting === `class:${c.id}`" @click="reject('class', c.id)">Tolak</button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>