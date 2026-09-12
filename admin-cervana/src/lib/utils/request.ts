import { PUBLIC_API_URL } from "$env/static/public";
import { authService } from "$lib/services/auth";
import type { ApiResponse, Query } from "$lib/types/api.type";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";

interface Tokens {
  access_token?: string;
  refresh_token?: string;
}

export async function request<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: any,
  headers: Record<string, string> = {},
  retry = true,
  fetchFn: typeof fetch = fetch,
  tokens?: Tokens
): Promise<ApiResponse<T>> {
  try {
    const authHeaders: Record<string, string> = {};

    if (tokens?.access_token) {
      authHeaders["Authorization"] = `Bearer ${tokens.access_token}`;
    }
    if (tokens?.refresh_token) {
      authHeaders["X-Refresh-Token"] = tokens.refresh_token;
    }

    const res = await fetchFn(`${PUBLIC_API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...headers,
      },
      credentials: "include",
      body:
        method !== "GET" && method !== "HEAD" && body
          ? JSON.stringify(body)
          : undefined,
    });

    if (res.status === 401 && retry) {
      const refreshed = await authService.refreshToken();
      if (refreshed.success) {
        return await request<T>(
          endpoint,
          method,
          body,
          headers,
          false,
          fetchFn,
          tokens
        );
      }
    }

    const data = (await res.json()) as ApiResponse<T>;

    return {
      success: data.success ?? res.ok,
      message: data.message || (res.ok ? "OK" : "Request failed"),
      data: data.data,
      meta: data.meta,
      error: data.error ?? null,
      code: data.code,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Request failed",
      error: err,
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
