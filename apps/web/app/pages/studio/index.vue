<script setup lang="ts">
useHead({ title: 'Studio Kreator — ReduCera' });
</script>

<template>
  <main>
    <h1>Studio</h1>
    <nav class="studio-nav">
      <NuxtLink to="/studio/articles">Artikel</NuxtLink>
      <NuxtLink to="/studio/classes">Kelas</NuxtLink>
      <NuxtLink to="/studio/simulations">Simulasi</NuxtLink>
      <NuxtLink to="/studio/quizzes">Kuis</NuxtLink>
    </nav>
    <section>
      <h2>Artikel Saya</h2>
      <NuxtLink to="/studio/articles/new">+ Buat artikel baru</NuxtLink>
    </section>
    <section>
      <h2>Kelas Saya</h2>
      <NuxtLink to="/studio/classes/new">+ Buat kelas baru</NuxtLink>
    </section>
  </main>
</template>