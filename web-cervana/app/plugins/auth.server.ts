import type { User } from "~/interfaces/auth"
import { setCookie } from "h3";


export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useState<User | null>('user')
  if (user.value !== undefined) return

  const config = useRuntimeConfig()
  const event = useRequestEvent()

  const fetchAuth = async (): Promise<any | null> => {
    try {
      return await $fetch<any>(`${config.public.API_URL}/auth/check`, {
        headers: {
          cookie: event?.req.headers.cookie || "",
        },
        credentials: "include",
      })
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await $fetch(`${config.public.API_URL}/auth/refresh-token`, {
            method: "POST",
            headers: {
              cookie: event?.req.headers.cookie || "",
            },
            credentials: "include",
          })
          return await $fetch<any>(`${config.public.API_URL}/auth/check`, {
            headers: {
              cookie: event?.req.headers.cookie || "",
            },
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
    if(event&& (res.data.access_token || res.data.refresh_token)){
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
