<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { statusMeta } from '~/lib/admin';
import { studioClassesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime } from '~/lib/format';
import { classMeta, priceText } from '~/lib/marketplace';
import { classProblem, httpsUrlProblem, isEditable, sessionProblem } from '~/lib/studio';

definePageMeta({
  title: 'Kelola Kelas — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const route = useRoute();
const classId = computed(() => String(route.params.id || ''));

const { data: item, status, error, refresh } = await useAsyncData(
  () => `studio:class:${classId.value}`,
  () => studioClassesApi.get(classId.value),
  { watch: [classId] },
);

const form = reactive({
  title: '',
  description: '',
  accessType: 'FREE' as 'FREE' | 'PAID',
  price: null as number | null,
  format: 'LIVE',
  difficulty: 'BEGINNER',
  durationMinutes: null as number | null,
  capacity: null as number | null,
});

watch(
  item,
  (value) => {
    if (!value) return;
    form.title = value.title;
    form.description = value.description ?? '';
    form.accessType = value.accessType;
    form.price = value.price === null || value.price === undefined ? null : Math.round(Number(value.price));
    form.format = value.format;
    form.difficulty = value.difficulty;
    form.durationMinutes = value.durationMinutes;
    form.capacity = value.capacity;
  },
  { immediate: true },
);

const editable = computed(() => !!item.value && isEditable(item.value.status));
const meta = computed(() => (item.value ? statusMeta('content', item.value.status) : null));
const saving = ref(false);
const acting = ref(false);
const notice = ref<string | null>(null);
const problem = ref<string | null>(null);

async function run(task: () => Promise<unknown>, done: string, failure: string): Promise<boolean> {
  notice.value = null;
  problem.value = null;
  try {
    await task();
    notice.value = done;
    await refresh();
    return true;
  } catch (err) {
    problem.value = describeApiError(err, failure);
    return false;
  }
}

async function save() {
  if (saving.value) return;
  const invalid = classProblem(form);
  if (invalid) {
    problem.value = invalid;
    return;
  }
  saving.value = true;
  await run(
    () =>
      studioClassesApi.update(classId.value, {
        title: form.title.trim(),
        description: form.description.trim(),
        accessType: form.accessType,
        ...(form.accessType === 'PAID' ? { price: form.price as number } : {}),
        format: form.format,
        difficulty: form.difficulty,
        ...(form.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
        ...(form.capacity ? { capacity: Number(form.capacity) } : {}),
      }),
    'Perubahan disimpan.',
    'Perubahan gagal disimpan.',
  );
  saving.value = false;
}

async function submitReview() {
  if (acting.value) return;
  acting.value = true;
  await run(() => studioClassesApi.submitReview(classId.value), 'Kelas dikirim untuk ditinjau.', 'Kelas gagal dikirim untuk ditinjau.');
  acting.value = false;
}

async function withdraw() {
  if (acting.value) return;
  acting.value = true;
  await run(() => studioClassesApi.withdraw(classId.value), 'Pengajuan ditarik. Kelas kembali menjadi draf.', 'Pengajuan gagal ditarik.');
  acting.value = false;
}

const session = reactive({ startsAt: '', endsAt: '', meetingUrl: '', recordingUrl: '' });
const sessionError = ref<string | null>(null);
const addingSession = ref(false);

async function addSession() {
  if (addingSession.value) return;
  const invalid =
    sessionProblem(session.startsAt, session.endsAt) ?? httpsUrlProblem(session.meetingUrl) ?? httpsUrlProblem(session.recordingUrl);
  if (invalid) {
    sessionError.value = invalid;
    return;
  }
  addingSession.value = true;
  sessionError.value = null;
  const ok = await run(
    () =>
      studioClassesApi.addSession(classId.value, {
        startsAt: new Date(session.startsAt).toISOString(),
        endsAt: new Date(session.endsAt).toISOString(),
        ...(session.meetingUrl.trim() ? { meetingUrl: session.meetingUrl.trim() } : {}),
        ...(session.recordingUrl.trim() ? { recordingUrl: session.recordingUrl.trim() } : {}),
      }),
    'Sesi ditambahkan.',
    'Sesi gagal ditambahkan.',
  );
  if (ok) Object.assign(session, { startsAt: '', endsAt: '', meetingUrl: '', recordingUrl: '' });
  addingSession.value = false;
}

async function cancelSession(sessionId: string) {
  if (acting.value) return;
  acting.value = true;
  await run(() => studioClassesApi.cancelSession(classId.value, sessionId), 'Sesi dibatalkan.', 'Sesi gagal dibatalkan.');
  acting.value = false;
}

useHead({ title: () => (item.value ? `${item.value.title} — Studio` : 'Kelola Kelas — Studio') });
</script>

<template>
  <div class="rc-stack">
    <LoadingSkeleton v-if="status === 'pending' && !item" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !item" title="Kelas tidak dapat dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <div class="rc-editor-head">
        <div class="rc-actions">
          <PlayButton to="/studio/classes" variant="ghost" size="sm">Kembali ke daftar</PlayButton>
          <StatusBadge v-if="meta" :tone="meta.tone" :label="meta.label" />
        </div>
        <div class="rc-actions">
          <PlayButton v-if="editable" size="sm" :loading="acting" @click="submitReview">Kirim untuk ditinjau</PlayButton>
          <PlayButton v-else-if="item.status === 'PENDING_REVIEW'" variant="secondary" size="sm" :loading="acting" @click="withdraw">Tarik pengajuan</PlayButton>
          <PlayButton v-if="item.status === 'PUBLISHED'" :to="`/marketplace/classes/${item.id}`" size="sm">Lihat di marketplace</PlayButton>
        </div>
      </div>

      <PageHeader :title="item.title" :subtitle="`${classMeta(item).join(' · ')} · ${priceText(item.accessType, item.price, item.currency)} · ${item._count.enrollments} peserta`" />

      <p v-if="item.status === 'REJECTED' && item.reviewNote" class="rc-alert rc-alert--error" role="note">Catatan peninjau: {{ item.reviewNote }}</p>
      <p v-if="notice" class="rc-alert rc-alert--success" role="status">{{ notice }}</p>
      <p v-if="problem" class="rc-alert rc-alert--error" role="alert">{{ problem }}</p>

      <PlayCard as="form" class="rc-studio-form" aria-label="Detail kelas" novalidate @submit.prevent="save">
        <label class="rc-label">
          Judul kelas
          <input v-model="form.title" class="rc-field" maxlength="160" :disabled="!editable" />
        </label>
        <label class="rc-label">
          Deskripsi
          <textarea v-model="form.description" rows="5" maxlength="20000" class="rc-field" :disabled="!editable" />
        </label>
        <div class="rc-studio-form__row">
          <label class="rc-label">
            Akses
            <select v-model="form.accessType" class="rc-field" :disabled="!editable">
              <option value="FREE">Gratis</option>
              <option value="PAID">Berbayar</option>
            </select>
          </label>
          <label v-if="form.accessType === 'PAID'" class="rc-label">
            Harga (Rp)
            <input v-model.number="form.price" type="number" min="1" step="1" class="rc-field" :disabled="!editable" />
          </label>
          <label class="rc-label">
            Format
            <select v-model="form.format" class="rc-field" :disabled="!editable">
              <option value="LIVE">Live</option>
              <option value="RECORDED">Rekaman</option>
              <option value="HYBRID">Hibrida</option>
            </select>
          </label>
          <label class="rc-label">
            Tingkat
            <select v-model="form.difficulty" class="rc-field" :disabled="!editable">
              <option value="BEGINNER">Pemula</option>
              <option value="INTERMEDIATE">Menengah</option>
              <option value="ADVANCED">Mahir</option>
            </select>
          </label>
          <label class="rc-label">
            Durasi (menit)
            <input v-model.number="form.durationMinutes" type="number" min="5" max="6000" class="rc-field" :disabled="!editable" />
          </label>
          <label class="rc-label">
            Kapasitas peserta
            <input v-model.number="form.capacity" type="number" min="1" class="rc-field" :disabled="!editable" />
          </label>
        </div>
        <div v-if="editable" class="rc-actions">
          <PlayButton type="submit" :loading="saving">Simpan perubahan</PlayButton>
        </div>
      </PlayCard>

      <section class="rc-stack" aria-labelledby="sessions-h">
        <h2 id="sessions-h" class="rc-h2">Jadwal sesi</h2>
        <ul v-if="item.sessions.length" class="rc-studio-sessions" aria-label="Daftar sesi">
          <li v-for="entry in item.sessions" :key="entry.id" class="rc-card">
            <div class="rc-studio-list__main">
              <p class="rc-studio-list__title">{{ formatDateTime(entry.startsAt) }} – {{ formatDateTime(entry.endsAt) }}</p>
              <p v-if="entry.status === 'CANCELLED'" class="rc-hint">Dibatalkan</p>
              <p v-else-if="entry.meetingUrl" class="rc-hint">Ada tautan ruang kelas</p>
            </div>
            <PlayButton v-if="entry.status !== 'CANCELLED'" variant="danger" size="sm" :loading="acting" @click="cancelSession(entry.id)">Batalkan sesi</PlayButton>
          </li>
        </ul>
        <p v-else class="rc-hint">Belum ada sesi. Tambahkan minimal satu sesi sebelum mengirim kelas untuk ditinjau.</p>

        <PlayCard as="form" class="rc-studio-form" aria-label="Tambah sesi" novalidate @submit.prevent="addSession">
          <div class="rc-studio-form__row">
            <label class="rc-label">
              Mulai
              <input v-model="session.startsAt" type="datetime-local" class="rc-field" />
            </label>
            <label class="rc-label">
              Selesai
              <input v-model="session.endsAt" type="datetime-local" class="rc-field" />
            </label>
          </div>
          <label class="rc-label">
            Tautan ruang kelas (opsional, https)
            <input v-model="session.meetingUrl" type="url" class="rc-field" placeholder="https://" />
          </label>
          <label class="rc-label">
            Tautan rekaman (opsional, https)
            <input v-model="session.recordingUrl" type="url" class="rc-field" placeholder="https://" />
          </label>
          <p v-if="sessionError" class="rc-alert rc-alert--error" role="alert">{{ sessionError }}</p>
          <div class="rc-actions">
            <PlayButton type="submit" variant="secondary" :loading="addingSession">Tambah sesi</PlayButton>
          </div>
        </PlayCard>
      </section>
    </template>
  </div>
</template>
