<script setup lang="ts">
definePageMeta({
  title: 'Profil Learner — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});
</script>

<template>
  <main id="main" aria-labelledby="profile-h">
    <h1 id="profile-h">Profil</h1>
    <ul class="rc-profile__menu">
      <li><NuxtLink to="/learn/profile/dashboard">Dashboard</NuxtLink></li>
      <li><NuxtLink to="/learn/profile/me">Akun</NuxtLink></li>
      <li><NuxtLink to="/learn/profile/settings">Pengaturan</NuxtLink></li>
      <li><NuxtLink to="/learn/profile/my-learning">Aktivitas saya</NuxtLink></li>
      <li><NuxtLink to="/credits">Kredit AI</NuxtLink></li>
      <li><NuxtLink to="/become-creator">Jadi Kreator</NuxtLink></li>
    </ul>
  </main>
</template>

<style scoped>
.rc-profile__menu {
  list-style: none;
  margin: 1rem 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-profile__menu a {
  display: block;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
  color: var(--ui-text);
  text-decoration: none;
}
.rc-profile__menu a:hover { background: var(--ui-bg-muted, #f3f4f6); }
</style>