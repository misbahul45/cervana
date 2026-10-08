<script setup lang="ts">
definePageMeta({
  title: 'Pengajuan Kreator — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const application = ref({
  state: 'eligible' as 'eligible' | 'already_applied' | 'pending' | 'rejected' | 'approved',
  reviewNote: '',
});

const masteryCount = ref(4);
const sandboxScore = ref(86);
const evidence = ref('');

function submit() {
  application.value.state = 'pending';
}
</script>

<template>
  <main id="main" aria-labelledby="apply-h">
    <h1 id="apply-h">Pengajuan Kreator</h1>

    <section aria-labelledby="status-h">
      <h2 id="status-h">Status Anda</h2>
      <p v-if="application.state === 'eligible'">
        Anda sudah memenuhi syarat. Konsep dikuasai: <strong>{{ masteryCount }}</strong>. Skor Sandbox rata-rata: <strong>{{ sandboxScore }}%</strong>.
      </p>
      <p v-else-if="application.state === 'already_applied'">
        Anda sudah pernah mengajukan. Tunggu tinjauan tim ReduCera.
      </p>
      <p v-else-if="application.state === 'pending'">
        Pengajuan sedang ditinjau.
      </p>
      <p v-else-if="application.state === 'rejected'">
        Pengajuan sebelumnya ditolak. Catatan tim: <q>{{ application.reviewNote || 'Belum ada catatan.' }}</q>
      </p>
      <p v-else-if="application.state === 'approved'">
        Selamat, Anda sudah menjadi kreator!
      </p>
    </section>

    <form
      v-if="application.state === 'eligible'"
      @submit.prevent="submit"
      class="rc-apply-form"
    >
      <h2>Ajukan diri Anda</h2>
      <label>
        Bukti portofolio (opsional)
        <textarea v-model="evidence" rows="4" placeholder="Tautan ke karya Anda, sertifikat, atau cerita singkat" />
      </label>
      <button type="submit" class="rc-apply-form__cta">Kirim pengajuan</button>
    </form>
  </main>
</template>

<style scoped>
.rc-apply-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}
.rc-apply-form textarea {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
}
.rc-apply-form__cta {
  align-self: flex-start;
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border: 0;
  font-weight: 600;
  cursor: pointer;
}
</style>