<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import TopicCover from '~/components/topics/TopicCover.vue';
import { marketplaceApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';
import { formatDate, formatDateTime } from '~/lib/format';
import { classAction, classMeta, externalUrl, priceText } from '~/lib/marketplace';
import { loginHref } from '~/lib/next-path';

definePageMeta({
  title: 'Kelas — ReduCera',
  protection: { kind: 'public' },
});

const route = useRoute();
const classId = computed(() => String(route.params.id || ''));
const user = useState<{ id: string } | null>('user', () => null);
const userKey = computed(() => user.value?.id ?? 'guest');

const { data: loaded, refresh } = await useAsyncData(
  () => `marketplace:class:${classId.value}`,
  async () => {
    try {
      return { ok: true as const, item: await marketplaceApi.class(classId.value) };
    } catch (err) {
      return {
        ok: false as const,
        missing: isApiError(err) && err.kind === 'not_found',
        message: describeApiError(err, 'Kelas tidak dapat dimuat.'),
      };
    }
  },
  { watch: [classId] },
);

const { data: holding, refresh: refreshHolding } = await useAsyncData(
  () => `marketplace:class-access:${classId.value}:${userKey.value}`,
  async () => {
    if (!user.value) return null;
    try {
      const access = await marketplaceApi.classAccess(classId.value);
      if (!access.accessible) return { accessible: false, materials: null };
      const materials = await marketplaceApi.classMaterials(classId.value).catch(() => null);
      return { accessible: true, materials };
    } catch {
      return null;
    }
  },
  { watch: [classId, userKey] },
);

const item = computed(() => (loaded.value?.ok ? loaded.value.item : null));
const missing = computed(() => loaded.value?.ok === false && loaded.value.missing);

if (import.meta.server && missing.value) setResponseStatus(useRequestEvent(), 404);

const action = computed(() =>
  item.value
    ? classAction({
        accessType: item.value.accessType,
        signedIn: Boolean(user.value),
        accessible: Boolean(holding.value?.accessible),
        seatsLeft: item.value.seatsLeft,
        isInstructor: Boolean(user.value && item.value.instructor?.id === user.value.id),
      })
    : null,
);

const price = computed(() => (item.value ? priceText(item.value.accessType, item.value.price, item.value.currency) : ''));
const meta = computed(() => (item.value ? classMeta(item.value) : []));
const sessions = computed(() => {
  const materials = holding.value?.materials?.sessions;
  if (materials) {
    return materials.map((session) => ({
      id: session.id,
      startsAt: session.startsAt,
      status: session.status,
      meetingUrl: externalUrl(session.meetingUrl),
      recordingUrl: externalUrl(session.recordingUrl),
    }));
  }
  return (item.value?.sessions ?? []).map((session) => ({
    id: session.id,
    startsAt: session.startsAt,
    status: session.status,
    meetingUrl: null,
    recordingUrl: null,
  }));
});

const purchase = usePurchase('CLASS', () => classId.value);
const enrolling = ref(false);
const enrollError = ref<string | null>(null);
const actionError = computed(() => purchase.error.value ?? enrollError.value);
const busy = computed(() => purchase.buying.value || enrolling.value);

async function enroll() {
  if (enrolling.value) return;
  enrolling.value = true;
  enrollError.value = null;
  try {
    await marketplaceApi.enrollFreeClass(classId.value);
    await refreshHolding();
    await refresh();
  } catch (err) {
    if (isApiError(err) && err.kind === 'unauthorized') {
      await navigateTo(loginHref(route.fullPath));
      return;
    }
    enrollError.value = describeApiError(err, 'Tidak bisa mendaftar ke kelas. Coba lagi.');
  } finally {
    enrolling.value = false;
  }
}

async function act() {
  if (!action.value) return;
  if (action.value.kind === 'login') await navigateTo(loginHref(route.fullPath));
  else if (action.value.kind === 'enroll') await enroll();
  else if (action.value.kind === 'buy') await purchase.buy();
}

useHead({
  title: () => (item.value ? `${item.value.title} — ReduCera` : 'Kelas — ReduCera'),
  meta: [
    { name: 'description', content: () => item.value?.description?.slice(0, 160) ?? 'Kelas akuntansi di ReduCera' },
    { property: 'og:title', content: () => item.value?.title ?? 'Kelas — ReduCera' },
    { property: 'og:image', content: () => item.value?.coverImage?.url ?? '' },
  ],
});
</script>

<template>
  <div v-if="item && action" class="rc-stack">
    <div>
      <PlayButton to="/marketplace" variant="ghost" size="sm">Kembali ke marketplace</PlayButton>
    </div>

    <div class="rc-cdetail">
      <article class="rc-cdetail__main" aria-labelledby="class-title">
        <div class="rc-cdetail__cover">
          <TopicCover :src="item.coverImage?.url" :title="item.title" />
        </div>
        <h1 id="class-title" class="rc-cdetail__title">{{ item.title }}</h1>
        <ul class="rc-cdetail__meta" aria-label="Info kelas">
          <li v-for="part in meta" :key="part">{{ part }}</li>
        </ul>
        <p class="rc-cdetail__by">
          Pengajar {{ item.instructor?.name ?? '-' }}<template v-if="item.tenant"> · {{ item.tenant.name }}</template
          ><template v-if="item.publishedAt"> · terbit {{ formatDate(item.publishedAt) }}</template>
        </p>
        <p v-if="item.description" class="rc-cdetail__text">{{ item.description }}</p>

        <section v-if="sessions.length" class="rc-cdetail__sessions" aria-labelledby="sessions-title">
          <h2 id="sessions-title" class="rc-h2">Jadwal sesi</h2>
          <ol class="rc-cdetail__list">
            <li v-for="session in sessions" :key="session.id" class="rc-card">
              <p class="rc-cdetail__when">{{ formatDateTime(session.startsAt) }}</p>
              <p v-if="session.status === 'CANCELLED'" class="rc-hint">Sesi dibatalkan</p>
              <a v-if="session.meetingUrl" :href="session.meetingUrl" target="_blank" rel="noopener noreferrer" class="rc-cdetail__link">Buka ruang kelas</a>
              <a v-if="session.recordingUrl" :href="session.recordingUrl" target="_blank" rel="noopener noreferrer" class="rc-cdetail__link">Tonton rekaman</a>
            </li>
          </ol>
        </section>
      </article>

      <aside class="rc-cdetail__aside" aria-label="Pendaftaran kelas">
        <div class="rc-card rc-cdetail__buy">
          <p class="rc-cdetail__price">{{ price }}</p>
          <p v-if="item.seatsLeft !== null" class="rc-hint">
            {{ item.seatsLeft > 0 ? `Sisa ${item.seatsLeft} dari ${item.capacity} kursi` : 'Semua kursi sudah terisi' }}
          </p>
          <p v-else-if="item.accessType === 'PAID'" class="rc-hint">Akses terbuka setelah pembayaranmu diverifikasi.</p>

          <p v-if="action.kind === 'enrolled'" class="rc-alert rc-alert--success" role="status">{{ action.label }}</p>
          <p v-else-if="action.kind === 'full' || action.kind === 'owner'" class="rc-alert" role="status">{{ action.label }}</p>
          <PlayButton v-else block :loading="busy" @click="act">{{ action.label }}</PlayButton>

          <p v-if="actionError" class="rc-alert rc-alert--error" role="alert">{{ actionError }}</p>
        </div>
      </aside>
    </div>
  </div>

  <div v-else-if="loaded" class="rc-stack">
    <PageHeader
      :title="missing ? 'Kelas tidak ditemukan' : 'Kelas gagal dimuat'"
      :subtitle="missing ? 'Kelas ini belum terbit atau sudah tidak tersedia.' : loaded.ok ? '' : loaded.message"
    />
    <div class="rc-actions">
      <PlayButton v-if="!missing" variant="secondary" @click="refresh()">Coba lagi</PlayButton>
      <PlayButton to="/marketplace">Kembali ke marketplace</PlayButton>
    </div>
  </div>
</template>
