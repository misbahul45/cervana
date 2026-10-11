import type {
  AdminApplicationRow,
  AdminContentDetail,
  AdminContentRow,
  AdminPayoutRow,
  AdminRefundRow,
  AdminTenantRow,
  AdminUserRow,
  AuditLogDetail,
  AuditLogRow,
  ContentKind,
  Paginated,
  QueueCounts,
} from '~/interfaces/admin';
import { request, toQueryString } from '~/lib/api';
import { unwrap, unwrapList } from '~/lib/api-error';

type Filters = Record<string, string | number | boolean | undefined | null>;

const clean = (filters: Filters): Filters =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''));

const listPath = (path: string, filters: Filters) => {
  const query = toQueryString(clean(filters));
  return query ? `${path}?${query}` : path;
};

const keyed = (key: string) => ({ 'Idempotency-Key': key });
const id = (value: string) => encodeURIComponent(value);
const contentBase = (kind: ContentKind) => (kind === 'article' ? '/admin/articles' : '/admin/classes');

export interface UploadedEvidence {
  url: string;
  fileId: string;
}

export const adminService = {
  users: {
    list: (filters: Filters) => request<Paginated<AdminUserRow>>(listPath('/users', filters)).then(unwrap),
    setRole: (userId: string, role: string, reason: string) =>
      request<unknown>(`/users/${id(userId)}/role`, 'POST', { role, reason }).then(unwrap),
    setActivation: (userId: string, isActive: boolean, reason: string) =>
      request<unknown>(`/users/${id(userId)}/activation`, 'POST', { isActive, reason }).then(unwrap),
  },

  tenants: {
    list: (filters: Filters) => request<Paginated<AdminTenantRow>>(listPath('/admin/tenants', filters)).then(unwrap),
    suspend: (tenantId: string, reason: string) =>
      request<unknown>(`/admin/tenants/${id(tenantId)}/suspend`, 'POST', { reason }).then(unwrap),
    activate: (tenantId: string, reason: string) =>
      request<unknown>(`/admin/tenants/${id(tenantId)}/activate`, 'POST', { reason }).then(unwrap),
  },

  payouts: {
    list: (filters: Filters) => request<Paginated<AdminPayoutRow>>(listPath('/admin/payouts', filters)).then(unwrap),
    startReview: (payoutId: string, key: string) =>
      request<unknown>(`/admin/payouts/${id(payoutId)}/start-review`, 'POST', {}, keyed(key)).then(unwrap),
    approve: (payoutId: string, key: string) =>
      request<unknown>(`/admin/payouts/${id(payoutId)}/approve`, 'POST', {}, keyed(key)).then(unwrap),
    reject: (payoutId: string, reason: string, key: string) =>
      request<unknown>(`/admin/payouts/${id(payoutId)}/reject`, 'POST', { reason }, keyed(key)).then(unwrap),
    markPaid: (payoutId: string, body: { evidence: UploadedEvidence; note?: string }, key: string) =>
      request<unknown>(`/admin/payouts/${id(payoutId)}/mark-paid`, 'POST', body, keyed(key)).then(unwrap),
  },

  refunds: {
    list: (filters: Filters) => request<Paginated<AdminRefundRow>>(listPath('/admin/refunds', filters)).then(unwrap),
    approve: (refundId: string, key: string) =>
      request<unknown>(`/admin/refunds/${id(refundId)}/approve`, 'POST', {}, keyed(key)).then(unwrap),
    reject: (refundId: string, reason: string, key: string) =>
      request<unknown>(`/admin/refunds/${id(refundId)}/reject`, 'POST', { reason }, keyed(key)).then(unwrap),
    process: (refundId: string, body: { evidence: UploadedEvidence; note?: string }, key: string) =>
      request<unknown>(`/admin/refunds/${id(refundId)}/process`, 'POST', body, keyed(key)).then(unwrap),
  },

  content: {
    list: (kind: ContentKind, filters: Filters) =>
      request<Paginated<AdminContentRow>>(listPath(contentBase(kind), filters)).then(unwrap),
    get: (kind: ContentKind, contentId: string) =>
      request<AdminContentDetail>(`${contentBase(kind)}/${id(contentId)}`).then(unwrap),
    approve: (kind: ContentKind, contentId: string, note?: string) =>
      request<unknown>(`${contentBase(kind)}/${id(contentId)}/approve`, 'POST', note ? { note } : {}).then(unwrap),
    reject: (kind: ContentKind, contentId: string, reason: string) =>
      request<unknown>(`${contentBase(kind)}/${id(contentId)}/reject`, 'POST', { reason }).then(unwrap),
    suspend: (kind: ContentKind, contentId: string, reason: string) =>
      request<unknown>(`${contentBase(kind)}/${id(contentId)}/suspend`, 'POST', { reason }).then(unwrap),
    reinstate: (kind: ContentKind, contentId: string, note?: string) =>
      request<unknown>(`${contentBase(kind)}/${id(contentId)}/reinstate`, 'POST', note ? { note } : {}).then(unwrap),
    archive: (kind: ContentKind, contentId: string, note?: string) =>
      request<unknown>(`${contentBase(kind)}/${id(contentId)}/archive`, 'POST', note ? { note } : {}).then(unwrap),
  },

  applications: {
    list: (filters: Filters) =>
      request<Paginated<AdminApplicationRow>>(listPath('/teacher/applications', filters)).then(unwrap),
    approve: (applicationId: string, feedback?: string) =>
      request<unknown>(`/teacher/applications/${id(applicationId)}/approve`, 'POST', feedback ? { feedback } : {}).then(unwrap),
    reject: (applicationId: string, feedback: string) =>
      request<unknown>(`/teacher/applications/${id(applicationId)}/reject`, 'POST', { feedback }).then(unwrap),
  },

  audit: {
    list: (filters: Filters) => request<Paginated<AuditLogRow>>(listPath('/admin/audit-logs', filters)).then(unwrap),
    actions: () => request<string[]>('/admin/audit-logs/actions').then(unwrapList),
    get: (logId: string) => request<AuditLogDetail>(`/admin/audit-logs/${id(logId)}`).then(unwrap),
  },

  async queueCounts(): Promise<QueueCounts> {
    const total = (path: string, filters: Filters) =>
      request<Paginated<unknown>>(listPath(path, { ...filters, limit: 1 })).then((res) => unwrap(res).pagination.total);
    const [payments, payouts, refunds, articles, classes, applications] = await Promise.all([
      total('/admin/payments/manual/submissions', { status: 'SUBMITTED' }),
      total('/admin/payouts', { status: 'REQUESTED' }),
      total('/admin/refunds', { status: 'REQUESTED' }),
      total('/admin/articles', { status: 'PENDING_REVIEW' }),
      total('/admin/classes', { status: 'PENDING_REVIEW' }),
      total('/teacher/applications', { status: 'PENDING' }),
    ]);
    return { payments, payouts, refunds, articles, classes, applications };
  },
};
