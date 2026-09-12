import type { ApiResponse, Tokens } from "~/interfaces/api";
import { authService } from "~/services/auth";
import { useAuth } from "~/stores/auth";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH";


export function getAiApiUrl() {
  const config = useRuntimeConfig();
  return config.public.AI_URL;
}

export async function requestAi<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: any,
  headers: Record<string, string> = {},
  retry = true,
  tokens?: Tokens
): Promise<ApiResponse<T>> {
  const AI_URL = getAiApiUrl();
  const isServer = typeof window === "undefined";

  const authHeaders: Record<string, string> = {};
  if (tokens?.access_token) authHeaders["Authorization"] = `Bearer ${tokens.access_token}`;
  if (tokens?.refresh_token) authHeaders["X-Refresh-Token"] = tokens.refresh_token;

  if (!isServer) {
    try {
      return await $fetch<ApiResponse<T>>(endpoint, {
        baseURL: AI_URL,
        method,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...headers,
        },
        credentials: "include",
      });
    } catch (error: any) {
      if (retry && error?.response?.status === 401) {
        const refreshed = await authService.refreshToken();

        if (refreshed.success && refreshed.data) {
          const auth = useAuth();
          auth.setTokens(
            refreshed.data.access_token,
            refreshed.data.refresh_token
          );
          const nextTokens: Tokens = {
            access_token: refreshed.data.access_token,
            refresh_token: refreshed.data.refresh_token,
          };
          return requestAi<T>(endpoint, method, body, headers, false, nextTokens);
        }
      }
      throw error;
    }
  }

  const res = await fetch(`${AI_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
    body: method !== "GET" && method !== "HEAD" && body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const refreshed = await authService.refreshToken(tokens);
    if (refreshed.success && refreshed.data) {
      const nextTokens: Tokens = {
        access_token: refreshed.data.access_token,
        refresh_token: refreshed.data.refresh_token,
      };
      return requestAi<T>(endpoint, method, body, headers, false, nextTokens);
    }
  }

  return (await res.json()) as ApiResponse<T>;
}
