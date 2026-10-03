<script setup lang="ts">
import { ref } from 'vue';
import { moderationApi } from '~/lib/api';

const data = ref<{ articles: any[]; classes: any[] }>({ articles: [], classes: [] });
const acting = ref<string | null>(null);
const error = ref<string | null>(null);

try {
  data.value = (await moderationApi.listPending()) ?? { articles: [], classes: [] };
} catch (e: any) {
  error.value = e?.message ?? 'load_failed';
}

async function approve(kind: 'article' | 'class', id: string) {
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.approve(kind, id);
    await refreshNuxtData();
  } finally {
    acting.value = null;
  }
}

async function reject(kind: 'article' | 'class', id: string) {
  const feedback = window.prompt('Alasan penolakan:') ?? '';
  if (!feedback) return;
  acting.value = `${kind}:${id}`;
  try {
    await moderationApi.reject(kind, id, feedback);
    await refreshNuxtData();
  } finally {
    acting.value = null;
  }
}

useHead({ title: 'Antrian Moderasi — Admin ReduCera' });
</script>

<template>
  <main>
    <h1>Antrian Moderasi</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <section>
      <h2>Artikel</h2>
      <ul>
        <li v-for="a in data?.articles ?? []" :key="`a-${a.id}`">
          <NuxtLink :to="`/studio/articles/${a.id}`">{{ a.title ?? a.id }}</NuxtLink>
          <button :disabled="acting === `article:${a.id}`" @click="approve('article', a.id)">Setujui</button>
          <button :disabled="acting === `article:${a.id}`" @click="reject('article', a.id)">Tolak</button>
        </li>
      </ul>
    </section>

    <section>
      <h2>Kelas</h2>
      <ul>
        <li v-for="c in data?.classes ?? []" :key="`c-${c.id}`">
          <NuxtLink :to="`/studio/classes/${c.id}`">{{ c.title ?? c.id }}</NuxtLink>
          <button :disabled="acting === `class:${c.id}`" @click="approve('class', c.id)">Setujui</button>
          <button :disabled="acting === `class:${c.id}`" @click="reject('class', c.id)">Tolak</button>
        </li>
      </ul>
    </section>
  </main>
</template>