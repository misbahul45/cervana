import type { ApiResponse, Query } from "~/interfaces/api";
import { authService } from "~/services/auth";
import { useAuth } from "~/stores/auth";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH";

interface Tokens {
  access_token?: string;
  refresh_token?: string;
}

export function getApiUrl() {
  const config = useRuntimeConfig();
  return config.public.API_URL;
}

export async function request<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: any,
  headers: Record<string, string> = {},
  retry: boolean = true,
  tokens?: Tokens
): Promise<ApiResponse<T>> {
  const API_URL = getApiUrl();
  const isServer = typeof window === "undefined";

  const authHeaders: Record<string, string> = {};
  if (tokens?.access_token) authHeaders["Authorization"] = `Bearer ${tokens.access_token}`;
  if (tokens?.refresh_token) authHeaders["X-Refresh-Token"] = tokens.refresh_token;

  try {
    if (!isServer) {
      try {
        return await $fetch<ApiResponse<T>>(endpoint, {
          baseURL: API_URL,
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          credentials: "include",
          body: method !== "GET" && method !== "HEAD" ? body : undefined,
        });
      } catch (error: any) {
        if (error?.response?.status === 401 && retry) {
          const refreshed = await authService.refreshToken();
          if (refreshed.success && refreshed.data) {
            const auth = useAuth();
            auth.setTokens(
              refreshed.data.access_token,
              refreshed.data.refresh_token
            );
            return await request<T>(
              endpoint,
              method,
              body,
              headers,
              false,
              {
                access_token: refreshed.data.access_token,
                refresh_token: refreshed.data.refresh_token,
              }
            );
          }
        }
        throw error;
      }
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...headers,
      },
      body:
        method !== "GET" && method !== "HEAD" && body
          ? JSON.stringify(body)
          : undefined,
    });

    if (res.status === 401 && retry) {
      const refreshed = await authService.refreshToken(tokens);
      if (refreshed.success && refreshed.data) {
        const accessCookie = useCookie("access_token");
        const refreshCookie = useCookie("refresh_token");

        accessCookie.value = refreshed.data.access_token;
        refreshCookie.value = refreshed.data.refresh_token;

        return await request<T>(
          endpoint,
          method,
          body,
          headers,
          false,
          {
            access_token: refreshed.data.access_token,
            refresh_token: refreshed.data.refresh_token,
          }
        );
      }
    }

    const data = (await res.json()) as ApiResponse<T>;
    return data;

  } catch (err: any) {
    return {
      success: false,
      message: err?.data?.message || "Request failed",
      error: JSON.stringify(err),
      data: null,
    };
  }
}

export function toQueryString(q: Query) {
  const params = new URLSearchParams();
  for (const key in q) {
    const value = q[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) params.append(key, value.join(","));
    else params.append(key, value.toString());
  }
  return params.toString();
}
