import { QueryClient, QueryCache } from '@tanstack/vue-query'

export default defineNuxtPlugin({
  enforce: 'pre',
  setup(nuxtApp) {
    nuxtApp.hook('nuxt-query:configure', (getPluginOptions) => {
      const queryClient = new QueryClient({
        queryCache: new QueryCache({
          onError: (error: unknown) => console.error('Query Error:', error),
        }),
      })
      getPluginOptions(queryClient)
    })
  },
})
