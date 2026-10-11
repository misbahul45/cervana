import { describe, expect, it } from 'vitest';
import {
  REASON_MAX,
  REASON_MIN,
  auditActionLabel,
  canChangeAccount,
  contentActions,
  dayEndIso,
  dayStartIso,
  prettyJson,
  evidenceProblem,
  EVIDENCE_MAX_BYTES,
  pageWindow,
  payoutActions,
  reasonProblem,
  refundActions,
  roleLabel,
  statusMeta,
  tenantAction,
} from '~/lib/admin';

describe('reasonProblem', () => {
  it('asks for a reason when it is blank or too short', () => {
    expect(reasonProblem('')).toMatch(/wajib/i);
    expect(reasonProblem('   ')).toMatch(/wajib/i);
    expect(reasonProblem('ab')).toMatch(/minimal 3/i);
  });

  it('accepts a reason within the bounds the API enforces, after trimming', () => {
    expect(reasonProblem('abc')).toBeNull();
    expect(reasonProblem('  abc  ')).toBeNull();
    expect(reasonProblem('x'.repeat(REASON_MAX))).toBeNull();
  });

  it('refuses a reason above the maximum', () => {
    expect(reasonProblem('x'.repeat(REASON_MAX + 1))).toMatch(/maksimal 500/i);
    expect(REASON_MIN).toBe(3);
  });
});

describe('statusMeta', () => {
  it('labels and tones the statuses of every queue', () => {
    expect(statusMeta('payout', 'REQUESTED')).toEqual({ label: 'Diajukan', tone: 'warning' });
    expect(statusMeta('payout', 'PAID')).toEqual({ label: 'Dibayar', tone: 'success' });
    expect(statusMeta('refund', 'PROCESSED')).toEqual({ label: 'Selesai', tone: 'success' });
    expect(statusMeta('content', 'PENDING_REVIEW')).toEqual({ label: 'Menunggu tinjauan', tone: 'info' });
    expect(statusMeta('content', 'SUSPENDED').tone).toBe('warning');
    expect(statusMeta('tenant', 'SUSPENDED').tone).toBe('error');
    expect(statusMeta('application', 'PENDING').tone).toBe('warning');
    expect(statusMeta('payment', 'APPROVED').tone).toBe('success');
  });

  it('never throws on a status it does not know: shows it as it is, neutral', () => {
    expect(statusMeta('payout', 'SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'neutral' });
  });
});

describe('payoutActions', () => {
  it('follows the payout state table', () => {
    expect(payoutActions('REQUESTED')).toEqual(['start-review', 'reject']);
    expect(payoutActions('UNDER_REVIEW')).toEqual(['approve', 'reject']);
    expect(payoutActions('APPROVED')).toEqual(['mark-paid', 'reject']);
  });

  it('offers nothing once a payout is final', () => {
    for (const status of ['PAID', 'REJECTED', 'CANCELLED']) expect(payoutActions(status)).toEqual([]);
  });
});

describe('refundActions', () => {
  it('follows the refund state table', () => {
    expect(refundActions('REQUESTED')).toEqual(['approve', 'reject']);
    expect(refundActions('APPROVED')).toEqual(['process', 'reject']);
    expect(refundActions('PROCESSED')).toEqual([]);
    expect(refundActions('REJECTED')).toEqual([]);
  });
});

describe('contentActions', () => {
  it('follows the content state table for moderation', () => {
    expect(contentActions('PENDING_REVIEW')).toEqual(['approve', 'reject']);
    expect(contentActions('PUBLISHED')).toEqual(['suspend', 'archive']);
    expect(contentActions('SUSPENDED')).toEqual(['reinstate', 'archive']);
    for (const status of ['DRAFT', 'REJECTED', 'ARCHIVED']) expect(contentActions(status)).toEqual([]);
  });
});

describe('tenantAction', () => {
  it('offers the one move that makes sense for the current status', () => {
    expect(tenantAction('ACTIVE')).toBe('suspend');
    expect(tenantAction('SUSPENDED')).toBe('activate');
    expect(tenantAction('ARCHIVED')).toBeNull();
  });
});

describe('canChangeAccount', () => {
  it('never lets an administrator change their own role or activation', () => {
    expect(canChangeAccount('admin-1', 'admin-1')).toBe(false);
    expect(canChangeAccount('admin-1', 'user-2')).toBe(true);
  });

  it('is false when the signed-in user is unknown', () => {
    expect(canChangeAccount(undefined, 'user-2')).toBe(false);
  });
});

describe('roleLabel', () => {
  it('names the four roles and falls back to the raw value', () => {
    expect(roleLabel('STUDENT')).toBe('Pelajar');
    expect(roleLabel('TEACHER')).toBe('Guru');
    expect(roleLabel('REVIEWER')).toBe('Peninjau');
    expect(roleLabel('ADMIN')).toBe('Admin');
    expect(roleLabel('OTHER')).toBe('OTHER');
  });
});

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('keeps first and last page and gaps marked, around the current page', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, '…', 20]);
    expect(pageWindow(10, 20)).toEqual([1, '…', 8, 9, 10, 11, 12, '…', 20]);
    expect(pageWindow(20, 20)).toEqual([1, '…', 18, 19, 20]);
  });

  it('never shows a gap marker for a single skipped page', () => {
    expect(pageWindow(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('is empty without pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});

describe('auditActionLabel', () => {
  it('translates the known actions', () => {
    expect(auditActionLabel('USER_ROLE_CHANGED')).toBe('Peran pengguna diubah');
    expect(auditActionLabel('MANUAL_PAYMENT_APPROVED')).toBe('Pembayaran manual disetujui');
  });

  it('turns an unknown action into readable words instead of hiding it', () => {
    expect(auditActionLabel('WHATEVER_HAPPENED_NOW')).toBe('Whatever happened now');
    expect(auditActionLabel('tutor_explain')).toBe('Tutor explain');
  });
});

describe('evidenceProblem', () => {
  it('asks for a file when there is none', () => {
    expect(evidenceProblem(null)).toMatch(/unggah/i);
    expect(evidenceProblem(undefined)).toMatch(/unggah/i);
  });

  it('accepts an image up to the size the upload endpoint takes', () => {
    expect(evidenceProblem({ name: 'bukti.PNG', size: 1000 })).toBeNull();
    expect(evidenceProblem({ name: 'bukti.webp', size: EVIDENCE_MAX_BYTES })).toBeNull();
  });

  it('refuses a file that is not an image, too large, or empty', () => {
    expect(evidenceProblem({ name: 'bukti.pdf', size: 1000 })).toMatch(/gambar/i);
    expect(evidenceProblem({ name: 'bukti', size: 1000 })).toMatch(/gambar/i);
    expect(evidenceProblem({ name: 'bukti.png', size: EVIDENCE_MAX_BYTES + 1 })).toMatch(/4 MB/);
    expect(evidenceProblem({ name: 'bukti.png', size: 0 })).toMatch(/kosong/i);
  });
});

describe('dayStartIso and dayEndIso', () => {
  it('cover a whole day in Jakarta time', () => {
    expect(dayStartIso('2026-10-11')).toBe('2026-10-10T17:00:00.000Z');
    expect(dayEndIso('2026-10-11')).toBe('2026-10-11T16:59:59.999Z');
  });

  it('ignore anything that is not a real calendar day', () => {
    for (const value of ['', 'kemarin', '2026-13-01', '2026-02-30', '2026-1-1', '2026-10-11T00:00']) {
      expect(dayStartIso(value)).toBeUndefined();
      expect(dayEndIso(value)).toBeUndefined();
    }
  });
});

describe('prettyJson', () => {
  it('indents objects and is empty for nothing', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(prettyJson(null)).toBe('');
    expect(prettyJson(undefined)).toBe('');
  });
});
