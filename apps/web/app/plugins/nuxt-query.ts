import { createQueryClient } from '~/lib/query-client'

export default defineNuxtPlugin({
  enforce: 'pre',
  setup(nuxtApp) {
    nuxtApp.hook('nuxt-query:configure', (getPluginOptions) => {
      getPluginOptions(createQueryClient((error) => console.error('Query Error:', error)))
    })
  },
})
