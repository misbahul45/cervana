<script setup lang="ts">
import { ref } from 'vue';

definePageMeta({
  title: 'Kredit AI — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const selectedPackage = ref<string | null>(null);

function select(id: string) {
  selectedPackage.value = id;
}
</script>

<template>
  <main id="main" aria-labelledby="credits-heading">
    <header class="rc-credits__header">
      <h1 id="credits-heading">Kredit AI</h1>
      <p>Isi ulang kredit AI Anda untuk berinteraksi dengan tutor.</p>
    </header>

    <section class="rc-credits__balance" aria-label="Saldo saat ini">
      <h2>Saldo saat ini</h2>
      <p class="rc-credits__balance-value"><strong>150</strong> kredit</p>
    </section>

    <section aria-labelledby="packages-heading">
      <h2 id="packages-heading">Paket kredit</h2>
      <div class="rc-credits__packages">
        <button
          v-for="pkg in [
            { id: 'p1', name: 'Paket Pemula', credits: 50, price: 'Rp 19.000' },
            { id: 'p2', name: 'Paket Belajar', credits: 200, price: 'Rp 69.000' },
            { id: 'p3', name: 'Paket Intensif', credits: 500, price: 'Rp 149.000' },
          ]"
          :key="pkg.id"
          type="button"
          :class="['rc-credits__package', selectedPackage === pkg.id ? 'rc-credits__package--selected' : '']"
          @click="select(pkg.id)"
        >
          <h3>{{ pkg.name }}</h3>
          <p>{{ pkg.credits }} kredit</p>
          <p>{{ pkg.price }}</p>
        </button>
      </div>
    </section>

    <section aria-labelledby="ledger-heading">
      <h2 id="ledger-heading">Riwayat penggunaan</h2>
      <p>Lihat detail penggunaan kredit di halaman profil learner.</p>
      <NuxtLink to="/learn/profile/me">Buka profil learner</NuxtLink>
    </section>

    <p v-if="selectedPackage" class="rc-credits__selected">
      Paket dipilih: <strong>{{ selectedPackage }}</strong>. Pembelian dilanjutkan ke alur pesanan.
    </p>
  </main>
</template>

<style scoped>
.rc-credits__header { margin-bottom: 1rem; }
.rc-credits__balance {
  padding: 1rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.04));
  border: 1px solid rgba(37, 99, 235, 0.15);
}
.rc-credits__balance-value { font-size: 1.5rem; margin-top: 0.5rem; }
.rc-credits__packages {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 1rem;
}
.rc-credits__package {
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  cursor: pointer;
  text-align: left;
}
.rc-credits__package--selected {
  border-color: var(--ui-primary, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.rc-credits__selected { margin-top: 1rem; color: var(--ui-text-muted); }
</style>