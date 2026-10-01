import type { User } from "~/interfaces/auth"
import { setCookie } from "h3";

const API_AUTH_PATHS = {
  check: '/auth/check',
  refresh: '/auth/refresh-token',
} as const;

export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useState<User | null>('user')
  if (user.value !== undefined) return

  const config = useRuntimeConfig()
  const event = useRequestEvent()
  const baseUrl = config.apiInternalUrl || config.public.API_URL

  const cookieHeader = event?.req.headers.cookie || ""

  const fetchAuth = async (): Promise<any | null> => {
    try {
      return await $fetch<any>(`${baseUrl}${API_AUTH_PATHS.check}`, {
        headers: { cookie: cookieHeader },
        credentials: "include",
      })
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await $fetch(`${baseUrl}${API_AUTH_PATHS.refresh}`, {
            method: "POST",
            headers: { cookie: cookieHeader },
            credentials: "include",
          })
          return await $fetch<any>(`${baseUrl}${API_AUTH_PATHS.check}`, {
            headers: { cookie: cookieHeader },
            credentials: "include",
          })
        } catch (refreshErr) {
          return null
        }
      }
      return null
    }
  }

  const res = await fetchAuth()

  if (res?.success && res.data?.authenticated && res.data.user) {
    if (event && (res.data.access_token || res.data.refresh_token)) {
      setCookie(event, "access_token", res.data.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });

      setCookie(event, "refresh_token", res.data.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
    }
    user.value = res.data.user
  } else {
    user.value = null
  }
})
