<script setup lang="ts">
import { computed, ref } from 'vue';
import { creatorApi } from '~/lib/api';

const route = useRoute();
const topicId = computed(() => String(route.query.topicId ?? ''));

const eligibility = ref<{ eligible: boolean; score: number | null } | null>(null);
try {
  eligibility.value = await creatorApi.checkEligibility(topicId.value);
} catch {
  eligibility.value = { eligible: false, score: null };
}

const form = reactive({
  fullName: '',
  bio: '',
  cvUrl: '',
  portfolioUrl: '',
  expertise: topicId.value,
  expertiseTopicId: topicId.value,
  experiences: [] as Array<{ title: string; institution?: string; startDate: string; endDate?: string; description?: string }>,
  certifications: [] as Array<{ name: string; issuer?: string; issuedDate?: string; credentialUrl?: string }>,
});
const submitting = ref(false);
const error = ref<string | null>(null);

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    await creatorApi.apply(form as unknown as Record<string, unknown>);
    await navigateTo('/my-learning/become-creator/success');
  } catch (e: any) {
    error.value = e?.message ?? 'submit_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Jadi Kreator — ReduCera' });
</script>

<template>
  <main>
    <h1>Jadi Kreator ReduCera</h1>
    <p v-if="!eligibility?.eligible" class="eligibility-warning">
      Anda belum eligible. Selesaikan topik dengan skor >= 85% terlebih dahulu.
    </p>
    <form v-else @submit.prevent="submit">
      <label> Nama lengkap <input v-model="form.fullName" required /> </label>
      <label> Topik keahlian (topic id) <input v-model="form.expertiseTopicId" required /> </label>
      <label> Bio <textarea v-model="form.bio" /> </label>
      <label> URL CV <input v-model="form.cvUrl" type="url" /> </label>
      <label> URL Portofolio <input v-model="form.portfolioUrl" type="url" /> </label>
      <fieldset>
        <legend>Pengalaman</legend>
        <div v-for="(exp, i) in form.experiences" :key="i">
          <input v-model="exp.title" placeholder="Judul" required />
          <input v-model="exp.institution" placeholder="Institusi" />
          <input v-model="exp.startDate" type="date" />
          <input v-model="exp.endDate" type="date" />
        </div>
        <button type="button" @click="form.experiences.push({ title: '', startDate: new Date().toISOString().slice(0, 10) })">
          Tambah pengalaman
        </button>
      </fieldset>
      <fieldset>
        <legend>Sertifikasi</legend>
        <div v-for="(cert, i) in form.certifications" :key="i">
          <input v-model="cert.name" placeholder="Nama" required />
          <input v-model="cert.issuer" placeholder="Penerbit" />
          <input v-model="cert.issuedDate" type="date" />
        </div>
        <button type="button" @click="form.certifications.push({ name: '' })">Tambah sertifikasi</button>
      </fieldset>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Mengirim…' : 'Kirim Lamaran' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>
</template>