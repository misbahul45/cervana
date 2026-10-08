<script setup lang="ts">
definePageMeta({
  title: 'Daftar Kelas — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});
</script>

<template>
  <main id="main" aria-labelledby="classes-h">
    <header class="rc-studio-classes__head">
      <h1 id="classes-h">Kelas</h1>
      <NuxtLink to="/studio/classes/new">+ Kelas baru</NuxtLink>
    </header>
    <LoadingSkeleton variant="row" :count="3" />
    <p>Detail per-kelas menyusul. Gunakan editor yang sama dengan artikel.</p>
  </main>
</template>

<style scoped>
.rc-studio-classes__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
</style>