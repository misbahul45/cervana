import type { CheckResponse, User } from '~/interfaces/auth'
import { authService } from '~/services/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useState<User | null>('user', () => null)
  const skipCheck = useState<boolean>('skipCheck', () => false)

  const publicPages = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/verify-email'
  ]

  const isPublicPage =
    publicPages.includes(to.path) ||
    (to.path.includes('/learn/topics') && !to.path.includes('order'))

  if (!user.value && !skipCheck.value) {
    try {
      const respon = await authService.check()
      const data = respon.data as CheckResponse
      user.value = data?.authenticated ? data.user : null
    } catch {
      user.value = null
    }
  }

  if (!user.value && !isPublicPage) {
    return navigateTo('/login')
  }

  if (user.value && publicPages.includes(to.path)) {
    return navigateTo('/learn/profile/dashboard')
  }
})
