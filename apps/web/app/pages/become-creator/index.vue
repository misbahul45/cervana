<script setup lang="ts">
definePageMeta({
  title: 'Jadi Kreator — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});
</script>

<template>
  <main id="main" aria-labelledby="become-creator-heading">
    <h1 id="become-creator-heading">Jadi Kreator</h1>
    <p>Setelah Anda menyelesaikan praktik yang cukup, Anda dapat mengajukan diri sebagai kreator.</p>

    <section aria-labelledby="path-heading">
      <h2 id="path-heading">Langkahnya</h2>
      <ol class="rc-become-creator__path">
        <li>Learner — kumpulkan pengalaman belajar.</li>
        <li>Practitioner — selesaikan skenario Sandbox dan tunjukkan pemahaman.</li>
        <li>Creator — ajukan bukti ke tim ReduCera.</li>
      </ol>
    </section>

    <section aria-labelledby="eligibility-heading">
      <h2 id="eligibility-heading">Syarat pengajuan</h2>
      <ul>
        <li>Telah menguasai minimal 3 konsep inti (persamaan akuntansi, double-entry, jurnal umum).</li>
        <li>Telah menyelesaikan minimal 5 skenario Sandbox dengan skor minimal 80%.</li>
        <li>Memiliki portofolio bukti (opsional).</li>
      </ul>
    </section>

    <section aria-labelledby="apply-heading">
      <h2 id="apply-heading">Status pengajuan</h2>
      <p>Anda belum pernah mengajukan. Klik tombol di bawah untuk memulai.</p>
      <NuxtLink to="/become-creator/apply" class="rc-become-creator__cta">
        Mulai pengajuan
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.rc-become-creator__path {
  padding-left: 1.5rem;
}
.rc-become-creator__path li {
  margin: 0.25rem 0;
}
.rc-become-creator__cta {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.625rem 1.25rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border-radius: 0.5rem;
  font-weight: 600;
}
</style>