import type { ApiResponse, Query } from "~/interfaces/api";
import { authService } from "~/services/auth";
import { useAuth } from "~/stores/auth";
import type {
  SandboxGraph,
  SandboxJournalEntry,
  SandboxJournalValidation,
  SandboxScenario,
  PlacementResult,
} from "~/interfaces/sandbox";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH";

interface Tokens {
  access_token?: string;
  refresh_token?: string;
}

export function getApiUrl() {
  const config = useRuntimeConfig();
  if (import.meta.server) {
    return config.apiInternalUrl || config.public.API_URL;
  }
  return config.public.API_URL;
}

export const sandboxApi = {
  listScenarios: (token?: string) =>
    request<SandboxScenario[]>(
      `${getApiUrl()}/api/v1/sandbox/scenarios`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  graph: (token?: string) =>
    request<SandboxGraph>(
      `${getApiUrl()}/api/v1/sandbox/graph`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? { levels: [] }),
  validateJournal: (
    body: { scenarioId?: string; entries: SandboxJournalEntry[] },
    token?: string,
  ) =>
    request<SandboxJournalValidation>(
      `${getApiUrl()}/api/v1/sandbox/journal/validate`,
      "POST",
      body,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as SandboxJournalValidation | undefined),
  placement: (answers: string[], token?: string) =>
    request<PlacementResult>(
      `${getApiUrl()}/api/v1/learning/placement-diagnostic`,
      "POST",
      { answers },
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as PlacementResult | undefined),
};

export const personalizationApi = {
  listMastery: (token?: string) =>
    request<MasteryScore[]>(
      `${getApiUrl()}/api/v1/personalization/mastery/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  listMisconceptions: (token?: string) =>
    request<MisconceptionPattern[]>(
      `${getApiUrl()}/api/v1/personalization/misconceptions/active`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  nextActivity: (token?: string) =>
    request<NextActivityDecision>(
      `${getApiUrl()}/api/v1/personalization/policy/next`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as NextActivityDecision | undefined),
  listSkillNodes: (token?: string) =>
    request<SkillNodeRecord[]>(
      `${getApiUrl()}/api/v1/personalization/skill-nodes/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
};

export const gamificationApi = {
  listBadges: (token?: string) =>
    request<UserAchievement[]>(
      `${getApiUrl()}/api/v1/gamify/badges/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  level: (token?: string) =>
    request<LevelInfo>(
      `${getApiUrl()}/api/v1/gamify/level/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as LevelInfo | undefined),
};

export const creatorApi = {
  checkEligibility: (topicId: string, token?: string) =>
    request<{ eligible: boolean; score: number | null }>(
      `${getApiUrl()}/api/v1/teacher/eligibility?topicId=${encodeURIComponent(topicId)}`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as { eligible: boolean; score: number | null } | undefined),
  apply: (body: Record<string, unknown>, token?: string) =>
    request(`${getApiUrl()}/api/v1/teacher/applications`, "POST", body, {}, true, token ? { access_token: token } : undefined),
  profile: (id: string, token?: string) =>
    request<Record<string, unknown>>(
      `${getApiUrl()}/api/v1/teacher/creators/${id}`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
};

export const moderationApi = {
  listPending: (token?: string) =>
    request<{ articles: any[]; classes: any[] }>(
      `${getApiUrl()}/api/v1/admin/moderation/pending`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? { articles: [], classes: [] }),
  approve: (kind: 'article' | 'class', id: string, token?: string) =>
    request(
      `${getApiUrl()}/api/v1/admin/moderation/${kind === 'article' ? 'articles' : 'classes'}/${id}/approve`,
      "POST",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ),
  reject: (kind: 'article' | 'class', id: string, feedback: string, token?: string) =>
    request(
      `${getApiUrl()}/api/v1/admin/moderation/${kind === 'article' ? 'articles' : 'classes'}/${id}/reject`,
      "POST",
      { feedback },
      {},
      true,
      token ? { access_token: token } : undefined,
    ),
};

export const checkoutApi = {
  listCreditPackages: (token?: string) =>
    request<any[]>(
      `${getApiUrl()}/api/v1/commerce/credit-packages`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  purchase: (slug: string, idempotencyKey: string, token?: string) =>
    request<{ orderId: string; reservationId: string; deduplicated?: boolean }>(
      `${getApiUrl()}/api/v1/commerce/credit-packages/${encodeURIComponent(slug)}/purchase`,
      "POST",
      undefined,
      { 'Idempotency-Key': idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      true,
    ).then((res) => res.data as { orderId: string; reservationId: string; deduplicated?: boolean }),
};

export const walletApi = {
  me: (token?: string) =>
    request<{ balance: number; currency: string; recent: any[] }>(
      `${getApiUrl()}/api/v1/commerce/wallet/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
};

export const earningsApi = {
  me: (token?: string) =>
    request<{ available: number; pending: number; currency: string }>(
      `${getApiUrl()}/api/v1/commerce/studio-earnings/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as { available: number; pending: number; currency: string }),
  history: (token?: string) =>
    request<any[]>(
      `${getApiUrl()}/api/v1/commerce/studio-earnings/history`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
};

export const withdrawalApi = {
  list: (token?: string) =>
    request<any[]>(
      `${getApiUrl()}/api/v1/commerce/withdrawals`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  request: (amount: number, idempotencyKey: string, token?: string) =>
    request<any>(
      `${getApiUrl()}/api/v1/commerce/withdrawals`,
      "POST",
      { amount },
      { 'Idempotency-Key': idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      true,
    ).then((res) => res.data),
};

export const agentApi = {
  run: (
    body: { userId: string; intent: string; query: string; lessonId?: string },
    token?: string,
  ) =>
    request<any>(`${getApiUrl()}/v1/agents/run`, "POST", body, {}, true, token ? { access_token: token } : undefined).then(
      (res) => res.data,
    ),
  listTraces: (token?: string) =>
    request<any[]>(
      `${getApiUrl()}/v1/agents/decision-trace/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
};

export const analyticsApi = {
  creatorMe: (token?: string) =>
    request<{ metrics: any[]; recentOrders: any[]; refundCount: number }>(
      `${getApiUrl()}/api/v1/analytics/creator/me`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
  adminOverview: (token?: string) =>
    request<{
      totalUsers: number;
      totalCreators: number;
      totalContent: number;
      totalAgentDecisions: number;
      recentEngagement: any[];
    }>(
      `${getApiUrl()}/api/v1/analytics/admin/overview`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
  topTopics: (token?: string) =>
    request<Array<{ topicId: string; learners: number; avgScore: number }>>(
      `${getApiUrl()}/api/v1/analytics/admin/top-topics`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  recordEvent: (
    body: { action: string; entityId?: string; metadata?: Record<string, unknown> },
    token?: string,
  ) =>
    request<any>(
      `${getApiUrl()}/api/v1/analytics/events`,
      "POST",
      body,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
};

export const simulatorApi = {
  listScenarios: (token?: string) =>
    request<{ slug: string; name: string; days: number }[]>(
      `${getApiUrl()}/api/v1/simulator/scenarios`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  create: (body: { scenarioSlug: string; days?: number }, token?: string) =>
    request<{ id: string }>(
      `${getApiUrl()}/api/v1/simulator/companies`,
      "POST",
      body,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as { id: string }),
  get: (id: string, token?: string) =>
    request<any>(
      `${getApiUrl()}/api/v1/simulator/companies/${id}`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
  listEntries: (id: string, token?: string) =>
    request<any[]>(
      `${getApiUrl()}/api/v1/simulator/companies/${id}/journal-entries`,
      "GET",
      undefined,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data ?? []),
  addEntry: (
    id: string,
    body: { date: string; debitAccount: string; creditAccount: string; amount: number; memo?: string },
    token?: string,
  ) =>
    request<any>(
      `${getApiUrl()}/api/v1/simulator/companies/${id}/journal-entries`,
      "POST",
      body,
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
  closePeriod: (id: string, period: string, token?: string) =>
    request<{ snapshotHash: string }>(
      `${getApiUrl()}/api/v1/simulator/companies/${id}/close-period`,
      "POST",
      { period },
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data as { snapshotHash: string }),
  statements: (id: string, period: string, token?: string) =>
    request<{
      incomeStatement: any;
      balanceSheet: any;
      cashFlow: any;
      snapshotHash: string;
    }>(
      `${getApiUrl()}/api/v1/simulator/companies/${id}/statements`,
      "POST",
      { period },
      {},
      true,
      token ? { access_token: token } : undefined,
    ).then((res) => res.data),
};

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
