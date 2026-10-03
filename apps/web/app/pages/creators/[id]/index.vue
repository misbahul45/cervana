<script setup lang="ts">
import { computed } from 'vue';
import { creatorApi } from '~/lib/api';

const route = useRoute();
const creatorId = computed(() => String(route.params.id));

const creator = ref<any | null>(null);
try {
  creator.value = (await creatorApi.profile(creatorId.value)) as any;
} catch {
  creator.value = null;
}

useHead({
  title: () => (creator.value?.fullName ? `${creator.value.fullName} — ReduCera` : 'Kreator'),
});
</script>

<template>
  <main v-if="creator">
    <h1>{{ creator.fullName }}</h1>
    <p v-if="creator.bio">{{ creator.bio }}</p>
    <p v-if="creator.portfolioUrl">
      <a :href="creator.portfolioUrl" rel="noopener">Portofolio</a>
    </p>

    <section>
      <h2>Artikel</h2>
      <ul>
        <li v-for="a in creator.articles ?? []" :key="a.id">
          <NuxtLink :to="`/marketplace/articles/${a.id}`">{{ a.title }}</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Kelas</h2>
      <ul>
        <li v-for="c in creator.classes ?? []" :key="c.id">
          <NuxtLink :to="`/marketplace/classes/${c.id}`">{{ c.title }}</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Badge</h2>
      <BadgeGrid :items="creator.badges ?? []" />
    </section>
  </main>
  <main v-else>
    <h1>Kreator tidak ditemukan</h1>
    <NuxtLink to="/">Kembali ke Beranda</NuxtLink>
  </main>
</template>