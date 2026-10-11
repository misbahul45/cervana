export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
export type StatusDomain = 'payout' | 'refund' | 'content' | 'tenant' | 'application' | 'payment';

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export function reasonProblem(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Alasan wajib diisi (minimal 3 karakter).';
  if (trimmed.length < REASON_MIN) return 'Alasan terlalu pendek (minimal 3 karakter).';
  if (trimmed.length > REASON_MAX) return 'Alasan terlalu panjang (maksimal 500 karakter).';
  return null;
}

const META: Record<StatusDomain, Record<string, { label: string; tone: Tone }>> = {
  payout: {
    REQUESTED: { label: 'Diajukan', tone: 'warning' },
    UNDER_REVIEW: { label: 'Ditinjau', tone: 'info' },
    APPROVED: { label: 'Disetujui', tone: 'info' },
    PAID: { label: 'Dibayar', tone: 'success' },
    REJECTED: { label: 'Ditolak', tone: 'error' },
    CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
  },
  refund: {
    REQUESTED: { label: 'Diajukan', tone: 'warning' },
    APPROVED: { label: 'Disetujui', tone: 'info' },
    PROCESSED: { label: 'Selesai', tone: 'success' },
    REJECTED: { label: 'Ditolak', tone: 'error' },
  },
  content: {
    DRAFT: { label: 'Draf', tone: 'neutral' },
    PENDING_REVIEW: { label: 'Menunggu tinjauan', tone: 'info' },
    PUBLISHED: { label: 'Terbit', tone: 'success' },
    REJECTED: { label: 'Ditolak', tone: 'error' },
    SUSPENDED: { label: 'Ditangguhkan', tone: 'warning' },
    ARCHIVED: { label: 'Diarsipkan', tone: 'neutral' },
  },
  tenant: {
    ACTIVE: { label: 'Aktif', tone: 'success' },
    SUSPENDED: { label: 'Ditangguhkan', tone: 'error' },
    ARCHIVED: { label: 'Diarsipkan', tone: 'neutral' },
  },
  application: {
    PENDING: { label: 'Menunggu', tone: 'warning' },
    APPROVED: { label: 'Disetujui', tone: 'success' },
    REJECTED: { label: 'Ditolak', tone: 'error' },
  },
  payment: {
    SUBMITTED: { label: 'Menunggu', tone: 'warning' },
    UNDER_REVIEW: { label: 'Ditinjau', tone: 'info' },
    APPROVED: { label: 'Disetujui', tone: 'success' },
    REJECTED: { label: 'Ditolak', tone: 'error' },
    CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
    EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
  },
};

export function statusMeta(domain: StatusDomain, status: string): { label: string; tone: Tone } {
  return META[domain][status] ?? { label: status, tone: 'neutral' };
}

export type PayoutAction = 'start-review' | 'approve' | 'reject' | 'mark-paid';
export type RefundAction = 'approve' | 'reject' | 'process';
export type ContentAction = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'archive';

const PAYOUT_ACTIONS: Record<string, PayoutAction[]> = {
  REQUESTED: ['start-review', 'reject'],
  UNDER_REVIEW: ['approve', 'reject'],
  APPROVED: ['mark-paid', 'reject'],
};

const REFUND_ACTIONS: Record<string, RefundAction[]> = {
  REQUESTED: ['approve', 'reject'],
  APPROVED: ['process', 'reject'],
};

const CONTENT_ACTIONS: Record<string, ContentAction[]> = {
  PENDING_REVIEW: ['approve', 'reject'],
  PUBLISHED: ['suspend', 'archive'],
  SUSPENDED: ['reinstate', 'archive'],
};

export const payoutActions = (status: string): PayoutAction[] => [...(PAYOUT_ACTIONS[status] ?? [])];
export const refundActions = (status: string): RefundAction[] => [...(REFUND_ACTIONS[status] ?? [])];
export const contentActions = (status: string): ContentAction[] => [...(CONTENT_ACTIONS[status] ?? [])];

export function tenantAction(status: string): 'suspend' | 'activate' | null {
  if (status === 'ACTIVE') return 'suspend';
  if (status === 'SUSPENDED') return 'activate';
  return null;
}

export function canChangeAccount(selfId: string | undefined, targetId: string): boolean {
  return Boolean(selfId) && selfId !== targetId;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Pelajar',
  TEACHER: 'Guru',
  REVIEWER: 'Peninjau',
  ADMIN: 'Admin',
};

export const ROLE_VALUES = ['STUDENT', 'TEACHER', 'REVIEWER', 'ADMIN'] as const;

export const roleLabel = (role: string): string => ROLE_LABELS[role] ?? role;

export function pageWindow(page: number, totalPages: number, span = 2): Array<number | '…'> {
  if (totalPages < 1) return [];
  const wanted = new Set<number>([1, totalPages]);
  for (let value = page - span; value <= page + span; value += 1) {
    if (value >= 1 && value <= totalPages) wanted.add(value);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined) {
      if (value - previous === 2) result.push(previous + 1);
      else if (value - previous > 2) result.push('…');
    }
    result.push(value);
  });
  return result;
}

const AUDIT_LABELS: Record<string, string> = {
  USER_ROLE_CHANGED: 'Peran pengguna diubah',
  USER_DEACTIVATED: 'Akun pengguna dinonaktifkan',
  MANUAL_PAYMENT_SUBMITTED: 'Bukti pembayaran dikirim',
  MANUAL_PAYMENT_REVIEW_STARTED: 'Peninjauan pembayaran dimulai',
  MANUAL_PAYMENT_APPROVED: 'Pembayaran manual disetujui',
  MANUAL_PAYMENT_REJECTED: 'Pembayaran manual ditolak',
  PAYMENT_RECONCILED: 'Pembayaran direkonsiliasi',
  PAYMENT_EXPIRE_SWEEP: 'Pembayaran kedaluwarsa disapu',
  ORDER_CREATED: 'Pesanan dibuat',
  ORDER_PAID: 'Pesanan dibayar',
  ORDER_FULFILLED: 'Pesanan dipenuhi',
  ORDER_CANCELLED: 'Pesanan dibatalkan',
  ORDER_REFUND_PENDING: 'Pengembalian dana diproses',
  ORDER_REFUNDED: 'Pesanan dikembalikan dananya',
  ARTICLE_CREATED: 'Artikel dibuat',
  ARTICLE_UPDATED: 'Artikel diperbarui',
  CLASS_CREATED: 'Kelas dibuat',
  CLASS_UPDATED: 'Kelas diperbarui',
  CLASS_ENROLLED: 'Pendaftaran kelas',
  CLASS_COMPLETED: 'Kelas diselesaikan',
  TENANT_CREATED: 'Tenant dibuat',
  TENANT_UPDATED: 'Tenant diperbarui',
  REWARD_REVERSED: 'Hadiah dibatalkan',
  PURCHASE_COMPLETED: 'Pembelian selesai',
  QUIZ_SUBMITTED: 'Kuis dikirim',
  LESSON_COMPLETED: 'Pelajaran selesai',
};

export function auditActionLabel(action: string): string {
  const known = AUDIT_LABELS[action];
  if (known) return known;
  const words = action.replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
const EVIDENCE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|tiff)$/i;

export function evidenceProblem(file: { name: string; size: number } | null | undefined): string | null {
  if (!file) return 'Unggah bukti terlebih dahulu.';
  if (!EVIDENCE_EXTENSIONS.test(file.name)) return 'Bukti harus berupa gambar (JPG, PNG, WebP, GIF).';
  if (file.size > EVIDENCE_MAX_BYTES) return 'Ukuran gambar maksimal 4 MB.';
  if (file.size === 0) return 'File kosong.';
  return null;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dayStartIso(value: string): string | undefined {
  return validDay(value) ? new Date(`${value}T00:00:00+07:00`).toISOString() : undefined;
}

export function dayEndIso(value: string): string | undefined {
  return validDay(value) ? new Date(`${value}T23:59:59.999+07:00`).toISOString() : undefined;
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
