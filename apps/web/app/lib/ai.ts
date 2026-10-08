import type { ApiResponse, Tokens } from "~/interfaces/api";
import { authService } from "~/services/auth";
import { failureEnvelope, forwardedCookie, normalizeEnvelope, relaySetCookies, statusOf } from "~/lib/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH";

const AI_PREFIX = "/ai/v1";

export function getAiApiUrl() {
  const config = useRuntimeConfig();
  if (typeof window === "undefined") {
    return config.aiInternalUrl || config.public.AI_URL;
  }
  return config.public.AI_URL;
}

export function normalizeAiPath(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    try {
      const parsed = new URL(endpoint);
      endpoint = parsed.pathname + parsed.search;
    } catch {
      return endpoint;
    }
  }
  if (endpoint.startsWith(AI_PREFIX)) return endpoint;
  return `${AI_PREFIX}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

export function aiUrl(path: string) {
  return `${getAiApiUrl()}${normalizeAiPath(path)}`;
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
  const path = normalizeAiPath(endpoint);
  const isServer = typeof window === "undefined";

  const authHeaders: Record<string, string> = {};
  if (tokens?.access_token) authHeaders["Authorization"] = `Bearer ${tokens.access_token}`;

  try {
    if (!isServer) {
      try {
        return await $fetch<ApiResponse<T>>(path, {
          baseURL: AI_URL,
          method,
          body: method !== "GET" && method !== "HEAD" ? body : undefined,
          headers: { "Content-Type": "application/json", ...headers },
          credentials: "include",
        });
      } catch (error: any) {
        if (retry && statusOf(error) === 401) {
          const refreshed = await authService.refreshToken();
          if (refreshed.success) return await requestAi<T>(endpoint, method, body, headers, false);
        }
        return failureEnvelope<T>(error);
      }
    }

    const res = await fetch(`${AI_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...forwardedCookie(tokens),
        ...authHeaders,
        ...headers,
      },
      body: method !== "GET" && method !== "HEAD" && body ? JSON.stringify(body) : undefined,
    });
    relaySetCookies(res);

    if (res.status === 401 && retry) {
      const refreshed = await authService.refreshToken(tokens);
      if (refreshed.success && refreshed.data) {
        return await requestAi<T>(endpoint, method, body, headers, false, {
          access_token: refreshed.data.access_token,
          refresh_token: refreshed.data.refresh_token,
        });
      }
    }

    return normalizeEnvelope<T>(await res.json().catch(() => null), res.status);
  } catch (err: any) {
    return failureEnvelope<T>(err);
  }
}
