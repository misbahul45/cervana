<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { creatorApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { applicationPayload, applicationProblem, applicationStage } from '~/lib/creator-application';
import { formatDate } from '~/lib/format';

definePageMeta({
  title: 'Jadi Kreator — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Jadi Kreator — ReduCera' });

const { data: application, status, error, refresh } = useAsyncData('creator:application', () => creatorApi.myApplication(), { lazy: true });

const stage = computed(() => applicationStage(application.value));

const form = reactive({ fullName: '', bio: '', expertise: '', portfolioUrl: '', cvUrl: '' });
const submitting = ref(false);
const formError = ref<string | null>(null);

async function submit() {
  if (submitting.value) return;
  const problem = applicationProblem(form);
  if (problem) {
    formError.value = problem;
    return;
  }
  submitting.value = true;
  formError.value = null;
  try {
    await creatorApi.apply(applicationPayload(form));
    await refresh();
  } catch (err) {
    formError.value = describeApiError(err, 'Pengajuan gagal dikirim. Coba lagi.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="rc-stack rc-pay">
    <PageHeader title="Jadi kreator" subtitle="Tulis artikel dan buka kelas di marketplace ReduCera. Admin meninjau setiap pengajuan." />

    <LoadingSkeleton v-if="status === 'pending' && !application" variant="panel" :count="2" />
    <ErrorState v-else-if="error" title="Status pengajuan gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <PlayCard v-else-if="stage === 'pending'" tone="info" as="section" aria-labelledby="stage-h">
      <h2 id="stage-h" class="rc-h2">Pengajuan sedang ditinjau</h2>
      <p>Pengajuan atas nama {{ application?.fullName }} dikirim {{ formatDate(application?.createdAt) }}. Kamu akan bisa membuka Studio setelah disetujui.</p>
    </PlayCard>

    <PlayCard v-else-if="stage === 'approved'" tone="success" as="section" aria-labelledby="stage-h">
      <h2 id="stage-h" class="rc-h2">Pengajuanmu disetujui</h2>
      <p v-if="application?.feedback">Catatan: {{ application.feedback }}</p>
      <div class="rc-actions">
        <PlayButton to="/studio">Buka Studio</PlayButton>
      </div>
    </PlayCard>

    <PlayCard v-else-if="stage === 'rejected'" tone="danger" as="section" aria-labelledby="stage-h">
      <h2 id="stage-h" class="rc-h2">Pengajuan belum disetujui</h2>
      <p>{{ application?.feedback || 'Admin tidak meninggalkan catatan.' }}</p>
      <p class="rc-hint">Hubungi admin bila kamu ingin mengajukan ulang.</p>
    </PlayCard>

    <PlayCard v-else as="form" class="rc-studio-form" aria-label="Form pengajuan kreator" novalidate @submit.prevent="submit">
      <label class="rc-label">
        Nama lengkap
        <input v-model="form.fullName" class="rc-field" maxlength="200" autocomplete="name" />
      </label>
      <label class="rc-label">
        Tentang kamu
        <textarea v-model="form.bio" rows="4" maxlength="5000" class="rc-field" />
      </label>
      <label class="rc-label">
        Bidang keahlian
        <input v-model="form.expertise" class="rc-field" maxlength="1000" placeholder="Contoh: perpajakan, akuntansi biaya" />
      </label>
      <label class="rc-label">
        Tautan portofolio (opsional)
        <input v-model="form.portfolioUrl" type="url" class="rc-field" placeholder="https://" />
      </label>
      <label class="rc-label">
        Tautan CV (opsional)
        <input v-model="form.cvUrl" type="url" class="rc-field" placeholder="https://" />
      </label>
      <p v-if="formError" class="rc-alert rc-alert--error" role="alert">{{ formError }}</p>
      <div class="rc-actions">
        <PlayButton type="submit" :loading="submitting">Kirim pengajuan</PlayButton>
      </div>
    </PlayCard>
  </div>
</template>
