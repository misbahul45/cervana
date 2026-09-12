<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useAsyncData, useHead, useRequestHeaders } from '#imports' 
import { ordersService } from '~/services/order'
import type { OrdersListResponse } from '~/interfaces/order'
import type { User } from '~/interfaces/auth'
import type { ApiResponse } from '~/interfaces/api'

const route = useRoute()
const user = useState<User | null>('user')

const headers = useRequestHeaders(['cookie'])
let access_token: string | undefined
let refresh_token: string | undefined

if (headers?.cookie) {
  const cookieStr = headers.cookie
  access_token = cookieStr.match(/access_token=([^;]+)/)?.[1]
  refresh_token = cookieStr.match(/refresh_token=([^;]+)/)?.[1]
}

const { data: resOrder } = await useAsyncData<ApiResponse<OrdersListResponse<false>>>(
  `order-${route.params.identifier}`,
  async () => {
    const tokens = { access_token, refresh_token }

    const result = await ordersService.findAll<false>({
      page: 1,
      limit: 1,
      userId: user.value?.id,
      topicId: route.params.identifier,
    }, tokens)

    if (!result.data?.data?.length) {
      const created = await ordersService.create({
        userId: user.value?.id,
        topicId: route.params.identifier as string,
      }, tokens)


      return {
        success: true,
        message: 'Order created',
        data: {
          data: [created.data],
          pagination: { total: 1, page: 1, limit: 1 },
        },
      } as ApiResponse<OrdersListResponse<false>>
    }

    return result
  }
)

const order = computed(() => resOrder.value?.data?.data[0])

console.log(order.value)

useHead({
  title: 'Transaksi Topik Sertifikasi | CERVANA',
  meta: [
    {
      name: 'description',
      content:
        'Lihat status transaksi topik sertifikasi Anda di CERVANA. Pantau pembayaran dan akses pembelajaran Anda di sini.',
    },
    {
      name: 'keywords',
      content:
        'CERVANA, transaksi, pembelian topik, sertifikasi, pembayaran, topik belajar, AI, gamifikasi',
    },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `https://cervana.ai${route.fullPath}` },
    {
      property: 'og:title',
      content: 'Transaksi Topik Sertifikasi | CERVANA',
    },
    {
      property: 'og:description',
      content:
        'Lihat detail transaksi pembelian topik sertifikasi Anda dan status pembayaran di platform pembelajaran CERVANA.',
    },
    { property: 'og:image', content: '/meta/og-order.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: 'Transaksi Topik Sertifikasi | CERVANA',
    },
    {
      name: 'twitter:description',
      content:
        'Pantau status transaksi pembelian topik sertifikasi Anda di CERVANA.',
    },
    { name: 'twitter:image', content: '/meta/og-order.png' },
  ],
})
</script>

<template>
  <section class="p-6 text-center">
    <h1 class="text-2xl font-bold text-primary mb-4">
      Transaksi Topik Sertifikasi
    </h1>
    <div v-if="order" class="text-gray-700 space-y-1">
      <p><strong>Status:</strong> {{ order.status }}</p>
      <p><strong>Jumlah:</strong> Rp{{ order.amount }}</p>
      <p><strong>Gateway:</strong> {{ order.gateway || '-' }}</p>
      <p><strong>Dibayar pada:</strong> {{ order.paidAt || 'Belum dibayar' }}</p>
    </div>

    <div v-else class="text-gray-500">
      Memuat data transaksi...
    </div>
  </section>
</template>
