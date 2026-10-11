<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { checkoutApi, walletApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatAmount } from '~/lib/format';

definePageMeta({
  title: 'Dompet — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Dompet — ReduCera' });

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
  <div class="rc-stack">
    <PageHeader title="Dompet" subtitle="Saldo dan paket kredit AI." />

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !overview" title="Gagal memuat dompet" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <ul class="rc-studio-stats" aria-label="Saldo">
        <li class="rc-card">
          <span class="rc-hint">Saldo</span>
          <strong>{{ overview.wallet ? formatAmount(overview.wallet.balance, overview.wallet.currency) : formatAmount(0) }}</strong>
        </li>
      </ul>

      <section class="rc-stack" aria-labelledby="packages-h">
        <h2 id="packages-h" class="rc-h2">Paket kredit AI</h2>
        <p class="rc-hint">Pembelian paket kredit belum dibuka. Daftar di bawah menunjukkan paket yang akan tersedia.</p>
        <EmptyState v-if="overview.packages.length === 0" title="Belum ada paket" message="Paket kredit akan muncul di sini setelah dibuka." />
        <ul v-else class="rc-studio-list" aria-label="Paket kredit">
          <li v-for="pkg in overview.packages" :key="pkg.id" class="rc-card">
            <div class="rc-studio-list__main">
              <p class="rc-studio-list__title">{{ pkg.name }}</p>
              <p class="rc-hint">{{ pkg.creditAmount }} kredit</p>
            </div>
            <strong>{{ formatAmount(pkg.priceAmount, pkg.priceCurrency) }}</strong>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
