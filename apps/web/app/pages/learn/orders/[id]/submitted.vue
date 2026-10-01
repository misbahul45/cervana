<script setup lang="ts">
const route = useRoute();
const orderId = route.params.id as string;

useHead({
  title: 'Bukti Pembayaran Terkirim | ReduCera',
});
</script>

<template>
  <div class="min-h-screen px-4 py-16 mx-auto max-w-2xl text-center" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <div class="p-8 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <h1 class="text-2xl md:text-3xl font-bold" :style="{ color: 'var(--rc-primary)' }">Bukti Pembayaran Terkirim</h1>
      <p class="mt-3" :style="{ color: 'var(--rc-fg)' }">
        Pesanan <code class="font-mono">#{{ orderId.slice(0, 8) }}</code> sedang menunggu verifikasi admin.
      </p>
      <p class="mt-2 text-sm" :style="{ color: 'var(--rc-muted)' }">
        Anda akan mendapat akses otomatis setelah pembayaran dikonfirmasi (biasanya 1-2 jam pada jam kerja).
      </p>

      <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <UButton to="/learn/orders" color="primary">Lihat Pesanan Saya</UButton>
        <UButton to="/marketplace" variant="outline">Kembali ke Marketplace</UButton>
      </div>
    </div>
  </div>
</template>
