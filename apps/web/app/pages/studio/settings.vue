<script setup lang="ts">
definePageMeta({
  title: 'Pengaturan Studio — ReduCera',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] },
  layout: 'studio',
});
</script>

<template>
  <main id="main" aria-labelledby="settings-h">
    <h1 id="settings-h">Pengaturan Studio</h1>
    <p>Hanya OWNER dan MANAGER yang dapat mengubah pengaturan payout, branding, dan kebijakan studio.</p>

    <section aria-labelledby="payout-h">
      <h2 id="payout-h">Rekening pencairan</h2>
      <p>Rekening tujuan pencairan saat ini: ****123456****</p>
      <NuxtLink to="/studio/payouts">Ubah rekening</NuxtLink>
    </section>

    <section aria-labelledby="brand-h">
      <h2 id="brand-h">Branding studio</h2>
      <p>Logo dan warna tema studio dapat diperbarui di sini.</p>
    </section>
  </main>
</template>

<style scoped>
section { margin-top: 1.5rem; }
</style>