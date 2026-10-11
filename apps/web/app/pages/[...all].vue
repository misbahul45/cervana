<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';

definePageMeta({
  title: 'Halaman tidak ditemukan — ReduCera',
  protection: { kind: 'public' },
  layout: 'public',
});

useHead({ title: 'Halaman tidak ditemukan — ReduCera' });

if (import.meta.server) setResponseStatus(useRequestEvent(), 404);

const router = useRouter();
</script>

<template>
  <div class="rc-stack rc-notfound">
    <p class="rc-notfound__code" aria-hidden="true">404</p>
    <h1 class="rc-notfound__title">Halaman tidak ditemukan</h1>
    <p class="rc-hint">Tautan ini sudah tidak berlaku atau halamannya sudah dipindahkan.</p>
    <div class="rc-actions rc-notfound__actions">
      <PlayButton to="/">Ke beranda</PlayButton>
      <PlayButton variant="secondary" @click="router.back()">Halaman sebelumnya</PlayButton>
    </div>
  </div>
</template>
