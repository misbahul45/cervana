import { Injectable } from '@nestjs/common';
import { ManualPaymentStatus, PaymentIntent, PaymentIntentStatus, PaymentProvider, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PaymentConfig } from '../../payment.config';
import {
  AdapterContext,
  CancelPaymentResult,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentMethodOption,
  PaymentPresentation,
  PaymentProviderAdapter,
  PaymentProviderCapabilities,
  PaymentStatusSnapshot,
  ReconcilePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../../payment.types';
import { manualReferenceCode, parseManualAccounts, tryParseManualAccounts } from './manual-payment.accounts';

export const MANUAL_PAYMENT_TYPE = 'MANUAL_INSTRUCTIONS';

@Injectable()
export class ManualPaymentProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.MANUAL;

  readonly capabilities: PaymentProviderCapabilities = {
    supportsCheckout: false,
    supportsWebhook: false,
    supportsRefund: true,
    supportsCapture: false,
    supportsPartialRefund: false,
  };

  constructor(private readonly config: PaymentConfig) {}

  listMethods(): PaymentMethodOption[] {
    const seen = new Map<string, PaymentMethodOption>();
    for (const account of tryParseManualAccounts(this.config.manualAccountsRaw)) {
      if (!seen.has(account.method)) {
        seen.set(account.method, { method: account.method, label: account.label });
      }
    }
    return [...seen.values()];
  }

  async createPaymentIntent(
    _ctx: AdapterContext,
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    const accounts = parseManualAccounts(this.config.manualAccountsRaw);
    const requested = typeof input.options?.method === 'string' ? input.options.method : null;
    if (requested && !accounts.some((account) => account.method === requested)) {
      throw new AppError(
        `Payment method ${requested} is not available`,
        422,
        AppErrorCode.VALIDATION_ERROR,
      );
    }
    return { providerPaymentId: null, metadata: { method: requested } };
  }

  presentPayment(intent: PaymentIntent): PaymentPresentation {
    const metadata = (intent.metadata ?? {}) as { method?: string | null };
    const accounts = tryParseManualAccounts(this.config.manualAccountsRaw).filter(
      (account) => !metadata.method || account.method === metadata.method,
    );
    return {
      type: MANUAL_PAYMENT_TYPE,
      data: {
        amount: intent.amount.toString(),
        currency: intent.currency,
        referenceCode: manualReferenceCode(intent.orderId),
        expiresAt: intent.expiresAt.toISOString(),
        accounts,
      },
    };
  }

  async getPaymentStatus(ctx: AdapterContext, intent: PaymentIntent): Promise<PaymentStatusSnapshot> {
    const latest = await ctx.tx.manualPaymentSubmission.findFirst({
      where: { paymentIntentId: intent.id },
      orderBy: { submittedAt: 'desc' },
      select: { status: true },
    });
    return { status: intent.status, providerStatus: latest?.status ?? null, observedAt: new Date() };
  }

  async cancelPayment(_ctx: AdapterContext, intent: PaymentIntent): Promise<CancelPaymentResult> {
    if (intent.status === PaymentIntentStatus.CREATED || intent.status === PaymentIntentStatus.PENDING) {
      return { allowed: true };
    }
    if (intent.status === PaymentIntentStatus.SUBMITTED) {
      return { allowed: false, reason: 'Payment proof is under review and cannot be cancelled' };
    }
    return { allowed: false, reason: `Payment in state ${intent.status} cannot be cancelled` };
  }

  async refundPayment(
    _ctx: AdapterContext,
    intent: PaymentIntent,
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    if (intent.status !== PaymentIntentStatus.PAID && intent.status !== PaymentIntentStatus.REFUND_PENDING) {
      throw new AppError(
        `Payment in state ${intent.status} cannot be refunded`,
        409,
        AppErrorCode.INVALID_STATE_TRANSITION,
      );
    }
    if (!input.amount.equals(intent.amount)) {
      throw new AppError(
        'Manual payments support full refunds only',
        422,
        AppErrorCode.VALIDATION_ERROR,
      );
    }
    return {
      mode: 'MANUAL',
      providerRefundId: null,
      status: 'PENDING',
      instructions: 'An administrator must transfer the funds back and attach the transfer evidence',
    };
  }

  async reconcilePayment(ctx: AdapterContext, intent: PaymentIntent): Promise<ReconcilePaymentResult> {
    const [submissions, captures] = await Promise.all([
      ctx.tx.manualPaymentSubmission.findMany({
        where: { paymentIntentId: intent.id },
        orderBy: { submittedAt: 'asc' },
        select: { id: true, status: true, amount: true },
      }),
      ctx.tx.paymentTransaction.findMany({
        where: { paymentIntentId: intent.id, type: 'CAPTURE', status: 'SUCCEEDED' },
        select: { id: true, amount: true, providerTransactionId: true },
      }),
    ]);

    const approved = submissions.filter((submission) => submission.status === ManualPaymentStatus.APPROVED);
    const open = submissions.filter(
      (submission) =>
        submission.status === ManualPaymentStatus.SUBMITTED ||
        submission.status === ManualPaymentStatus.UNDER_REVIEW,
    );
    const discrepancies: string[] = [];
    const paidLike: PaymentIntentStatus[] = [
      PaymentIntentStatus.PAID,
      PaymentIntentStatus.REFUND_PENDING,
      PaymentIntentStatus.REFUNDED,
    ];

    if (paidLike.includes(intent.status)) {
      if (approved.length !== 1) {
        discrepancies.push(`Expected exactly one approved submission, found ${approved.length}`);
      } else if (!new Prisma.Decimal(approved[0].amount).equals(intent.amount)) {
        discrepancies.push('Approved submission amount differs from the payment amount');
      }
      if (captures.length !== 1) {
        discrepancies.push(`Expected exactly one successful capture, found ${captures.length}`);
      } else {
        if (!new Prisma.Decimal(captures[0].amount).equals(intent.amount)) {
          discrepancies.push('Capture amount differs from the payment amount');
        }
        if (approved.length === 1 && captures[0].providerTransactionId !== approved[0].id) {
          discrepancies.push('Capture does not reference the approved submission');
        }
      }
    } else {
      if (approved.length > 0) {
        discrepancies.push('Approved submission exists but the payment is not paid');
      }
      if (captures.length > 0) {
        discrepancies.push('Successful capture exists but the payment is not paid');
      }
    }

    if (intent.status === PaymentIntentStatus.SUBMITTED && open.length !== 1) {
      discrepancies.push(`Expected exactly one open submission, found ${open.length}`);
    }
    if (intent.status !== PaymentIntentStatus.SUBMITTED && open.length > 0) {
      discrepancies.push('Open submission exists but the payment is not awaiting review');
    }

    return {
      providerStatus: submissions.length > 0 ? submissions[submissions.length - 1].status : null,
      consistent: discrepancies.length === 0,
      discrepancies,
    };
  }
}
