import { Injectable } from '@nestjs/common';
import { ManualPaymentStatus, PaymentIntentStatus, PaymentProvider, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { UploadsService } from '../../../uploads/uploads.service';
import { assertOwnedUploadedFile } from '../../../uploads/uploaded-file';
import { PaymentConfig } from '../../payment.config';
import { PaymentService } from '../../payment.service';
import { PaymentActorRef } from '../../payment.types';
import {
  ManualQueueQueryDtoType,
  SubmitManualPaymentDtoType,
} from './manual-payment.dto';

const OPEN_STATUSES: ManualPaymentStatus[] = [ManualPaymentStatus.SUBMITTED, ManualPaymentStatus.UNDER_REVIEW];

const submissionInclude = {
  payer: { select: { id: true, name: true, email: true } },
  order: {
    select: {
      id: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          articleId: true,
          classId: true,
          topicId: true,
          tenantId: true,
        },
      },
    },
  },
  paymentIntent: { select: { id: true, status: true, amount: true, currency: true, expiresAt: true } },
} satisfies Prisma.ManualPaymentSubmissionInclude;

const buyerSubmissionSelect = {
  id: true,
  status: true,
  paymentMethod: true,
  referenceNumber: true,
  amount: true,
  note: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
} satisfies Prisma.ManualPaymentSubmissionSelect;

@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly config: PaymentConfig,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async submit(actor: Actor, intentId: string, dto: SubmitManualPaymentDtoType, traceId?: string) {
    await this.payments.expireIfDue(intentId);

    const result = await this.prisma.$transaction(async (tx) => {
      const intent = await this.payments.lockIntent(tx, intentId);
      const order = await tx.order.findUnique({ where: { id: intent.orderId }, select: { userId: true, status: true } });

      if (!order || order.userId !== actor.id) {
        throw new AppError('Payment not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (intent.provider !== PaymentProvider.MANUAL) {
        throw new AppError('This payment does not accept manual proof', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (intent.status === PaymentIntentStatus.EXPIRED) {
        throw new AppError('The payment window has expired', 409, AppErrorCode.PAYMENT_EXPIRED);
      }
      if (intent.status !== PaymentIntentStatus.PENDING) {
        throw new AppError(
          `Payment in state ${intent.status} does not accept a proof`,
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const metadata = (intent.metadata ?? {}) as { method?: string | null };
      if (metadata.method && metadata.method !== dto.paymentMethod) {
        throw new AppError('Payment method does not match the order', 422, AppErrorCode.VALIDATION_ERROR);
      }
      const available = this.payments
        .listMethods()
        .methods.some((option) => option.method === dto.paymentMethod);
      if (!available) {
        throw new AppError('Payment method is not available', 422, AppErrorCode.VALIDATION_ERROR);
      }

      this.assertProof(actor, dto.proof);

      const attempts = await tx.manualPaymentSubmission.count({ where: { paymentIntentId: intent.id } });
      if (attempts >= this.config.maxSubmissionsPerIntent) {
        throw new AppError(
          'The maximum number of payment proofs has been reached',
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const submission = await tx.manualPaymentSubmission.create({
        data: {
          orderId: intent.orderId,
          paymentIntentId: intent.id,
          payerId: actor.id,
          paymentMethod: dto.paymentMethod,
          amount: intent.amount,
          referenceNumber: dto.referenceNumber ?? null,
          proofUrl: dto.proof,
          note: dto.note ?? null,
          status: ManualPaymentStatus.SUBMITTED,
        },
        select: buyerSubmissionSelect,
      });

      const payer: PaymentActorRef = { kind: 'BUYER', id: actor.id, role: actor.role };
      const moved = await this.payments.markSubmitted(tx, intent.id, submission.id, { actor: payer, traceId });

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MANUAL_PAYMENT_SUBMITTED',
          entityType: 'ManualPaymentSubmission',
          entityId: submission.id,
          after: { status: submission.status, paymentIntentId: intent.id },
          traceId,
        },
        tx,
      );

      return { submission, intent: moved };
    });

    return {
      message: 'Payment proof submitted',
      data: { submission: result.submission, paymentStatus: result.intent.status },
    };
  }

  async listForIntent(actor: Actor, intentId: string) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      select: { id: true, order: { select: { userId: true } } },
    });
    if (!intent || (intent.order.userId !== actor.id && !this.policy.isAdmin(actor))) {
      throw new AppError('Payment not found', 404, AppErrorCode.NOT_FOUND);
    }
    const submissions = await this.prisma.manualPaymentSubmission.findMany({
      where: { paymentIntentId: intentId },
      orderBy: { submittedAt: 'desc' },
      select: buyerSubmissionSelect,
    });
    return { message: 'Successfully retrieved payment submissions', data: submissions };
  }

  async queue(actor: Actor, query: ManualQueueQueryDtoType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.ManualPaymentSubmissionWhereInput = {
      status: query.status ? query.status : { in: OPEN_STATUSES },
    };
    const [data, total] = await Promise.all([
      this.prisma.manualPaymentSubmission.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: submissionInclude,
      }),
      this.prisma.manualPaymentSubmission.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved payment queue',
      data: {
        data,
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      },
    };
  }

  async findOne(actor: Actor, id: string) {
    this.policy.assertAdmin(actor);
    const submission = await this.prisma.manualPaymentSubmission.findUnique({
      where: { id },
      include: submissionInclude,
    });
    if (!submission) {
      throw new AppError('Payment submission not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved payment submission', data: submission };
  }

  async startReview(actor: Actor, id: string, traceId?: string) {
    this.policy.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const { intentId } = await this.resolveIntent(tx, id);
      await this.payments.lockIntent(tx, intentId);
      const submission = await tx.manualPaymentSubmission.findUniqueOrThrow({ where: { id } });

      if (submission.status === ManualPaymentStatus.UNDER_REVIEW) {
        return { message: 'Submission already under review', data: { id, status: submission.status } };
      }
      if (submission.status !== ManualPaymentStatus.SUBMITTED) {
        throw new AppError(
          `Submission in state ${submission.status} cannot be reviewed`,
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const updated = await tx.manualPaymentSubmission.update({
        where: { id },
        data: { status: ManualPaymentStatus.UNDER_REVIEW, reviewedById: actor.id },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MANUAL_PAYMENT_REVIEW_STARTED',
          entityType: 'ManualPaymentSubmission',
          entityId: id,
          before: { status: submission.status },
          after: { status: updated.status },
          traceId,
        },
        tx,
      );
      return { message: 'Submission moved to review', data: { id, status: updated.status } };
    });
  }

  async approve(actor: Actor, id: string, reason: string, traceId?: string) {
    this.policy.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const { intentId } = await this.resolveIntent(tx, id);
      const intent = await this.payments.lockIntent(tx, intentId);
      const submission = await tx.manualPaymentSubmission.findUniqueOrThrow({ where: { id } });

      if (submission.status === ManualPaymentStatus.APPROVED) {
        return {
          message: 'Payment already approved',
          data: { id, status: submission.status, paymentStatus: intent.status, changed: false },
        };
      }
      if (submission.status === ManualPaymentStatus.REJECTED) {
        throw new AppError('A rejected submission cannot be approved', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (intent.status !== PaymentIntentStatus.SUBMITTED) {
        throw new AppError(
          `Payment in state ${intent.status} cannot be approved`,
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }
      if (!new Prisma.Decimal(submission.amount).equals(intent.amount)) {
        throw new AppError('Submission amount does not match the payment', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }

      const approved = await tx.manualPaymentSubmission.update({
        where: { id },
        data: { status: ManualPaymentStatus.APPROVED, reviewedById: actor.id, reviewedAt: new Date() },
      });

      const verified = await this.payments.markVerified(
        tx,
        intent.id,
        {
          providerTransactionId: submission.id,
          externalReference: submission.referenceNumber,
          rawReference: {
            submissionId: submission.id,
            paymentMethod: submission.paymentMethod,
            reviewedBy: actor.id,
          },
        },
        { actor: { kind: 'ADMIN', id: actor.id, role: actor.role }, reason, traceId },
      );

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MANUAL_PAYMENT_APPROVED',
          entityType: 'ManualPaymentSubmission',
          entityId: id,
          before: { status: submission.status },
          after: { status: approved.status },
          reason,
          traceId,
        },
        tx,
      );

      return {
        message: 'Payment approved',
        data: { id, status: approved.status, paymentStatus: verified.intent.status, changed: verified.changed },
      };
    });
  }

  async reject(actor: Actor, id: string, input: { reason: string; allowResubmit: boolean }, traceId?: string) {
    this.policy.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const { intentId } = await this.resolveIntent(tx, id);
      const intent = await this.payments.lockIntent(tx, intentId);
      const submission = await tx.manualPaymentSubmission.findUniqueOrThrow({ where: { id } });

      if (submission.status === ManualPaymentStatus.REJECTED) {
        return {
          message: 'Payment already rejected',
          data: { id, status: submission.status, paymentStatus: intent.status, changed: false },
        };
      }
      if (submission.status === ManualPaymentStatus.APPROVED) {
        throw new AppError('An approved submission cannot be rejected', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (intent.status !== PaymentIntentStatus.SUBMITTED) {
        throw new AppError(
          `Payment in state ${intent.status} cannot be rejected`,
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const rejected = await tx.manualPaymentSubmission.update({
        where: { id },
        data: {
          status: ManualPaymentStatus.REJECTED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        },
      });

      const attempts = await tx.manualPaymentSubmission.count({ where: { paymentIntentId: intent.id } });
      const canRetry = input.allowResubmit && attempts < this.config.maxSubmissionsPerIntent;
      const ctx = {
        actor: { kind: 'ADMIN', id: actor.id, role: actor.role } as PaymentActorRef,
        reason: input.reason,
        traceId,
      };
      const moved = canRetry
        ? await this.payments.returnToPending(tx, intent.id, ctx)
        : (await this.payments.markFailed(tx, intent.id, ctx)).intent;

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MANUAL_PAYMENT_REJECTED',
          entityType: 'ManualPaymentSubmission',
          entityId: id,
          before: { status: submission.status },
          after: { status: rejected.status, resubmit: canRetry },
          reason: input.reason,
          traceId,
        },
        tx,
      );

      return {
        message: canRetry ? 'Payment rejected; the buyer may submit a new proof' : 'Payment rejected',
        data: { id, status: rejected.status, paymentStatus: moved.status, changed: true },
      };
    });
  }

  private async resolveIntent(tx: Prisma.TransactionClient, submissionId: string) {
    const ref = await tx.manualPaymentSubmission.findUnique({
      where: { id: submissionId },
      select: { paymentIntentId: true },
    });
    if (!ref) {
      throw new AppError('Payment submission not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { intentId: ref.paymentIntentId };
  }

  private assertProof(actor: Actor, proof: { url: string; fileId: string }) {
    assertOwnedUploadedFile(this.uploads, actor, proof, 'Proof');
  }
}
