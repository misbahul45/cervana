import type { Paginated } from '~/interfaces/commerce';

export type { Paginated };

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: string | null;
  image: { url: string } | null;
  provider: string;
  role: 'STUDENT' | 'TEACHER' | 'REVIEWER' | 'ADMIN';
  isActive: boolean;
  totalPoints: number;
  stars: number;
  currentStreak: number;
  createdAt: string;
}

export interface AdminTenantRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string;
}

export interface TenantRef {
  id: string;
  name: string;
  slug: string;
  status?: string;
}

export interface AdminPayoutRow {
  id: string;
  amount: string | number;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';
  destinationInfo: { bankName: string; accountNumber: string; accountName: string } | null;
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  evidenceUrl: string | null;
  creator: PersonRef | null;
  tenant: TenantRef | null;
}

export interface AdminRefundRow {
  id: string;
  orderId: string;
  amount: string | number;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  approvedAt: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  requestedBy: PersonRef | null;
  order: { id: string; total: string | number; currency: string; userId: string } | null;
}

export type ContentKind = 'article' | 'class';

export interface AdminContentRow {
  id: string;
  title: string;
  slug: string | null;
  excerpt?: string | null;
  description?: string | null;
  accessType: 'FREE' | 'PAID';
  price: string | number | null;
  currency: string;
  format?: string;
  difficulty?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef | null;
  author?: PersonRef | null;
}

export interface AdminContentDetail extends AdminContentRow {
  versions?: Array<{ id: string; versionNumber: number; title: string; content: string; publishedAt: string | null }>;
  sessions?: Array<{ id: string; startsAt: string; endsAt: string; meetingUrl?: string | null; status?: string }>;
}

export interface AdminApplicationRow {
  id: string;
  userId: string;
  fullName: string;
  bio: string | null;
  cvUrl: string | null;
  portfolioUrl: string | null;
  expertise: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  feedback: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: PersonRef | null;
}

export interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  traceId: string | null;
  createdAt: string;
  actor: AuditActor | null;
}

export interface AuditLogDetail extends AuditLogRow {
  before: unknown;
  after: unknown;
}

export interface QueueCounts {
  payments: number;
  payouts: number;
  refunds: number;
  articles: number;
  classes: number;
  applications: number;
}
