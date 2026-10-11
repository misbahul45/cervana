<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';

definePageMeta({
  title: 'Bukti Pembayaran Terkirim — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Bukti Pembayaran Terkirim — ReduCera' });

const route = useRoute();
const orderId = computed(() => String(route.params.id || ''));
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Bukti pembayaran terkirim" :subtitle="`Pesanan #${orderId.slice(0, 8)} menunggu verifikasi admin.`" />
    <PlayCard tone="success" as="section" aria-labelledby="submitted-next">
      <h2 id="submitted-next" class="rc-h2">Apa selanjutnya</h2>
      <p>Akses ke artikel atau kelas terbuka otomatis setelah admin memverifikasi pembayaranmu. Kamu bisa memantau statusnya di halaman pesanan.</p>
      <div class="rc-actions">
        <PlayButton :to="`/learn/orders/${orderId}`">Lihat pesanan</PlayButton>
        <PlayButton to="/marketplace" variant="secondary">Kembali ke marketplace</PlayButton>
      </div>
    </PlayCard>
  </div>
</template>
