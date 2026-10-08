import type { QueryKey } from '@tanstack/vue-query';

export function qk(...parts: unknown[]): QueryKey {
  const flat: unknown[] = [];
  for (const part of parts) {
    if (part === undefined || part === null) continue;
    if (Array.isArray(part)) {
      for (const sub of part) {
        if (sub !== undefined && sub !== null) flat.push(sub);
      }
    } else if (typeof part === 'object') {
      const keys = Object.keys(part as Record<string, unknown>).sort();
      for (const key of keys) {
        flat.push(key);
        const value = (part as Record<string, unknown>)[key];
        if (value !== undefined && value !== null) flat.push(value);
      }
    } else {
      flat.push(part);
    }
  }
  return flat;
}

export const QK = {
  auth: {
    me: () => qk('auth', 'me'),
    check: () => qk('auth', 'check'),
  },
  learner: {
    dashboard: () => qk('learner', 'dashboard'),
    onboarding: () => qk('learner', 'onboarding'),
    nextActivity: () => qk('learner', 'nextActivity'),
    mastery: (topicId?: string) => qk('learner', 'mastery', { topicId }),
    progress: () => qk('learner', 'progress'),
    streak: () => qk('learner', 'streak'),
  },
  curriculum: {
    topic: (topicId: string) => qk('topic', topicId),
    topics: (filters?: Record<string, unknown>) => qk('topics', filters ?? {}),
    lesson: (lessonId: string) => qk('lesson', lessonId),
    lessons: (topicId?: string) => qk('lessons', { topicId }),
    skillTree: () => qk('skillTree'),
  },
  tutor: {
    session: (sessionId: string) => qk('tutor', 'session', sessionId),
    history: () => qk('tutor', 'history'),
  },
  sandbox: {
    scenarios: (filters?: Record<string, unknown>) => qk('sandbox', 'scenarios', filters ?? {}),
    scenario: (scenarioId: string) => qk('sandbox', 'scenario', scenarioId),
    attempt: (attemptId: string) => qk('sandbox', 'attempt', attemptId),
  },
  marketplace: {
    products: (filters?: Record<string, unknown>) => qk('marketplace', 'products', filters ?? {}),
    product: (slug: string) => qk('marketplace', 'product', slug),
  },
  commerce: {
    orders: (status?: string) => qk('orders', 'list', { status }),
    order: (id: string) => qk('order', id),
  },
  credits: {
    balance: () => qk('credits', 'me'),
    ledger: () => qk('credits', 'ledger'),
    packages: () => qk('credits', 'packages'),
  },
  creator: {
    studio: () => qk('creator', 'studio'),
    article: (id: string) => qk('creator', 'article', id),
    articles: () => qk('creator', 'articles'),
    earnings: () => qk('creator', 'earnings'),
    payouts: () => qk('creator', 'payouts'),
  },
  review: {
    queue: () => qk('review', 'queue'),
    item: (id: string) => qk('review', 'item', id),
  },
  admin: {
    payments: (status?: string) => qk('admin', 'payments', { status }),
    payouts: () => qk('admin', 'payouts'),
    refunds: () => qk('admin', 'refunds'),
    teacherApplications: () => qk('admin', 'teacherApplications'),
    moderation: () => qk('admin', 'moderation'),
    users: () => qk('admin', 'users'),
    tenants: () => qk('admin', 'tenants'),
    agents: () => qk('admin', 'agents'),
    themes: () => qk('admin', 'themes'),
    audit: () => qk('admin', 'audit'),
  },
  notifications: () => qk('notifications'),
};

export type { QueryKey };