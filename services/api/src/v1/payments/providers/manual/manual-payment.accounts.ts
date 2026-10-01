import z from 'zod';
import { AppError, AppErrorCode } from '@/common/lib/error';

const ManualAccountSchema = z.object({
  method: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  label: z.string().min(2).max(80),
  accountNumber: z.string().min(3).max(64),
  accountName: z.string().min(2).max(120),
});

const ManualAccountsSchema = z.array(ManualAccountSchema).min(1).max(20);

export type ManualAccount = z.infer<typeof ManualAccountSchema>;

export function parseManualAccounts(raw: string | undefined): ManualAccount[] {
  if (!raw || raw.trim().length === 0) {
    throw new AppError(
      'Manual payment is not configured',
      503,
      AppErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
    );
  }
  try {
    return ManualAccountsSchema.parse(JSON.parse(raw));
  } catch {
    throw new AppError(
      'Manual payment configuration is invalid',
      503,
      AppErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
    );
  }
}

export function tryParseManualAccounts(raw: string | undefined): ManualAccount[] {
  try {
    return parseManualAccounts(raw);
  } catch {
    return [];
  }
}

export function manualReferenceCode(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 10).toUpperCase();
}
