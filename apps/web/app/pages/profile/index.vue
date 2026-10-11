<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayCard from '~/components/play/PlayCard.vue';

definePageMeta({
  title: 'Profil — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Profil — ReduCera' });

const MENU = [
  { to: '/learn/profile/dashboard', label: 'Beranda belajar', hint: 'Ringkasan XP, streak, dan topik aktif' },
  { to: '/learn/profile/me', label: 'Akun', hint: 'Data diri dan pencapaian' },
  { to: '/learn/profile/settings', label: 'Pengaturan', hint: 'Preferensi akun' },
  { to: '/learn/profile/my-learning', label: 'Topik saya', hint: 'Topik yang sedang kamu pelajari' },
  { to: '/learn/orders', label: 'Pesanan', hint: 'Pembayaran dan pembelian' },
  { to: '/wallet', label: 'Dompet', hint: 'Saldo dan paket kredit' },
  { to: '/become-creator', label: 'Jadi kreator', hint: 'Ajukan diri untuk menulis dan mengajar' },
];
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Profil" subtitle="Semua yang berkaitan dengan akunmu." />
    <ul class="rc-studio-list" aria-label="Menu profil">
      <li v-for="item in MENU" :key="item.to" class="rc-card rc-card--interactive">
        <NuxtLink :to="item.to" class="rc-studio-list__main rc-profile__link">
          <p class="rc-studio-list__title">{{ item.label }}</p>
          <p class="rc-hint">{{ item.hint }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
