<script setup lang="ts">
import { checkoutApi, walletApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Dompet Saya — ReduCera',
  protection: { kind: 'authenticated' },
});

useHead({ title: 'Dompet Saya — ReduCera' });

const { data: overview, status, error, refresh } = useAsyncData(
  'wallet:overview',
  async () => {
    const [wallet, packages] = await Promise.all([walletApi.me(), checkoutApi.listCreditPackages()]);
    return { wallet, packages };
  },
  { lazy: true },
);
</script>

<template>
  <main id="main" aria-labelledby="wallet-h">
    <h1 id="wallet-h">Dompet</h1>

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="error || !overview"
      title="Gagal memuat dompet"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <template v-else>
      <p v-if="overview.wallet">
        Saldo: <strong>{{ formatMoney(overview.wallet.balance, overview.wallet.currency) }}</strong>
      </p>
      <p v-else>Anda belum memiliki dompet.</p>

      <section aria-labelledby="packages-h">
        <h2 id="packages-h">Paket Kredit</h2>
        <p>Pembelian paket kredit belum dibuka.</p>
        <ul v-if="overview.packages.length">
          <li v-for="pkg in overview.packages" :key="pkg.id">
            <strong>{{ pkg.name }}</strong>
            <p>{{ pkg.creditAmount }} kredit — {{ formatMoney(pkg.priceAmount, pkg.priceCurrency) }}</p>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
