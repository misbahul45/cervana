import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentIntentStatus, Prisma, RefundStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { CommerceConfig } from '../commerce/commerce.config';
import { money } from '../commerce/money';
import { OrderLifecycleService } from '../orders/order-lifecycle.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { PaymentService } from '../payments/payment.service';
import { REFUND_AGGREGATE, RefundEventPayload, RefundEvents } from '../payments/payment-events';
import { PaymentActorRef } from '../payments/payment.types';
import { assertOwnedUploadedFile } from '../uploads/uploaded-file';
import { UploadsService } from '../uploads/uploads.service';
import { assertRefundTransition, REFUND_OPEN_STATES } from './refund-state';
import { ProcessRefundDtoType, RefundQueryDtoType } from './refunds.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

const listSelect = {
  id: true,
  orderId: true,
  paymentIntentId: true,
  amount: true,
  reason: true,
  status: true,
  requestedById: true,
  approvedAt: true,
  rejectionReason: true,
  processedAt: true,
  evidenceUrl: true,
  createdAt: true,
} satisfies Prisma.RefundSelect;

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
    private readonly config: CommerceConfig,
    private readonly lifecycle: OrderLifecycleService,
    private readonly payments: PaymentService,
    private readonly registry: PaymentProviderRegistry,
    private readonly uploads: UploadsService,
  ) {}

  async request(actor: Actor, orderId: string, reason: string, traceId?: string) {
    const isAdmin = this.policy.isAdmin(actor);
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.lifecycle.lock(tx, orderId);
      if (!isAdmin && order.userId !== actor.id) {
        throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (order.status === OrderStatus.REFUND_PENDING) {
        const open = await tx.refund.findFirst({
          where: { orderId, status: { in: [...REFUND_OPEN_STATES] } },
          select: listSelect,
        });
        if (open) return { refund: open, created: false };
      }
      if (order.status !== OrderStatus.FULFILLED) {
        throw new AppError(`An order in state ${order.status} cannot be refunded`, 409, AppErrorCode.INVALID_ORDER_STATE);
      }

      const paid = await tx.paymentIntent.findFirst({
        where: { orderId, status: PaymentIntentStatus.PAID },
        select: { id: true },
      });
      if (!paid) {
        throw new AppError('This order has no verified payment to refund', 409, AppErrorCode.INVALID_PAYMENT_STATE);
      }
      const intent = await this.payments.lockIntent(tx, paid.id);
      if (!isAdmin && intent.paidAt && Date.now() > intent.paidAt.getTime() + this.config.refundWindowDays * DAY_MS) {
        throw new AppError('The refund window for this order has closed', 409, AppErrorCode.INVALID_ORDER_STATE);
      }
      await this.assertNotConsumed(tx, order.id);

      const refund = await tx.refund.create({
        data: {
          orderId,
          paymentIntentId: intent.id,
          amount: intent.amount,
          reason,
          status: RefundStatus.REQUESTED,
          requestedById: actor.id,
        },
        select: listSelect,
      });

      const ref: PaymentActorRef = { kind: isAdmin ? 'ADMIN' : 'BUYER', id: actor.id, role: actor.role };
      await this.payments.markRefundPending(tx, intent.id, { actor: ref, reason, traceId });
      await this.lifecycle.transition(tx, orderId, OrderStatus.REFUND_PENDING, {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ORDER_REFUND_PENDING',
        reason,
        traceId,
      });
      await this.record(tx, actor, 'REFUND_REQUESTED', refund.id, null, RefundStatus.REQUESTED, reason, traceId);
      await this.publish(tx, RefundEvents.Requested, refund, actor.id, traceId);
      return { refund, created: true };
    });
    return { message: result.created ? 'Refund requested' : 'A refund request is already open', data: result.refund };
  }

  approve(actor: Actor, id: string, traceId?: string) {
    return this.review(actor, id, RefundStatus.APPROVED, 'REFUND_APPROVED', traceId, {
      event: RefundEvents.Approved,
      prepare: async (tx, refund) => {
        const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: refund.paymentIntentId } });
        await this.registry.get(intent.provider).refundPayment({ tx, traceId }, intent, {
          amount: money(refund.amount),
          reason: refund.reason,
        });
      },
    });
  }

  reject(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.review(actor, id, RefundStatus.REJECTED, 'REFUND_REJECTED', traceId, {
      reason,
      prepare: async (tx, refund) => {
        const ref: PaymentActorRef = { kind: 'ADMIN', id: actor.id, role: actor.role };
        await this.payments.restorePaid(tx, refund.paymentIntentId, { actor: ref, reason, traceId });
        await this.lifecycle.transition(tx, refund.orderId, OrderStatus.FULFILLED, {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'ORDER_REFUND_REFUSED',
          reason,
          traceId,
        });
      },
    });
  }

  async process(actor: Actor, id: string, dto: ProcessRefundDtoType, traceId?: string) {
    assertOwnedUploadedFile(this.uploads, actor, dto.evidence, 'Evidence');
    return this.review(actor, id, RefundStatus.PROCESSED, 'REFUND_PROCESSED', traceId, {
      evidence: dto.evidence,
      note: dto.note,
      event: RefundEvents.Completed,
      prepare: async (tx, refund) => {
        await this.assertNotConsumed(tx, refund.orderId);
        const ref: PaymentActorRef = { kind: 'ADMIN', id: actor.id, role: actor.role };
        await this.payments.markRefunded(
          tx,
          refund.paymentIntentId,
          { id: refund.id, amount: money(refund.amount), evidenceReference: dto.evidence.fileId },
          { actor: ref, reason: dto.note, traceId },
        );
      },
    });
  }

  async listMine(actor: Actor, query: RefundQueryDtoType) {
    const where: Prisma.RefundWhereInput = { requestedById: actor.id, ...(query.status && { status: query.status }) };
    return this.page(where, query, listSelect);
  }

  async queue(actor: Actor, query: RefundQueryDtoType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.RefundWhereInput = {
      status: query.status ?? { in: [...REFUND_OPEN_STATES] },
    };
    return this.page(where, query, {
      ...listSelect,
      requestedBy: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, total: true, currency: true, userId: true } },
    }, { createdAt: 'asc' });
  }

  async findOne(actor: Actor, id: string) {
    this.policy.assertAdmin(actor);
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      select: {
        ...listSelect,
        approvedById: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, total: true, currency: true, userId: true, status: true, items: true } },
        paymentIntent: { select: { id: true, provider: true, status: true, amount: true, paidAt: true } },
      },
    });
    if (!refund) {
      throw new AppError('Refund not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved refund', data: refund };
  }

  private async review(
    actor: Actor,
    id: string,
    target: RefundStatus,
    action: string,
    traceId: string | undefined,
    options: {
      reason?: string;
      note?: string;
      evidence?: Prisma.InputJsonValue;
      event?: string;
      prepare?: (tx: Prisma.TransactionClient, refund: Prisma.RefundGetPayload<Record<string, never>>) => Promise<void>;
    },
  ) {
    this.policy.assertAdmin(actor);
    const result = await this.prisma.$transaction(async (tx) => {
      const ref = await tx.refund.findUnique({ where: { id }, select: { orderId: true, paymentIntentId: true } });
      if (!ref) {
        throw new AppError('Refund not found', 404, AppErrorCode.NOT_FOUND);
      }
      const order = await this.lifecycle.lock(tx, ref.orderId);
      if (order.userId === actor.id) {
        throw new AppError('You cannot review a refund on your own order', 403, AppErrorCode.OWNERSHIP_DENIED);
      }
      await this.payments.lockIntent(tx, ref.paymentIntentId);
      await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${id} FOR UPDATE`;
      const refund = await tx.refund.findUniqueOrThrow({ where: { id } });

      if (refund.status === target) {
        return { refund, changed: false };
      }
      assertRefundTransition(refund.status, target);

      if (options.prepare) await options.prepare(tx, refund);

      const now = new Date();
      const updated = await tx.refund.update({
        where: { id },
        data: {
          status: target,
          ...(target !== RefundStatus.REJECTED && !refund.approvedById && { approvedById: actor.id, approvedAt: now }),
          ...(options.reason && { rejectionReason: options.reason }),
          ...(target === RefundStatus.PROCESSED && { processedAt: now, evidenceUrl: options.evidence }),
        },
      });

      await this.record(tx, actor, action, id, refund.status, target, options.reason ?? options.note, traceId);
      if (options.event) await this.publish(tx, options.event, updated, actor.id, traceId);
      return { refund: updated, changed: true };
    });
    return {
      message: result.changed ? 'Refund updated' : 'Refund already in the requested state',
      data: { id, status: result.refund.status, changed: result.changed },
    };
  }

  private async assertNotConsumed(tx: Prisma.TransactionClient, orderId: string) {
    const completed = await tx.classEnrollment.findFirst({
      where: { orderId, status: 'COMPLETED' },
      select: { id: true },
    });
    if (completed) {
      throw new AppError('A completed class cannot be refunded', 409, AppErrorCode.INVALID_ORDER_STATE);
    }
  }

  private async page(
    where: Prisma.RefundWhereInput,
    query: RefundQueryDtoType,
    select: Prisma.RefundSelect,
    orderBy: Prisma.RefundOrderByWithRelationInput = { createdAt: 'desc' },
  ) {
    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({ where, select, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.refund.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved refunds',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  private record(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    id: string,
    before: RefundStatus | null,
    after: RefundStatus,
    reason: string | undefined,
    traceId: string | undefined,
  ) {
    return this.audit.record(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action,
        entityType: 'Refund',
        entityId: id,
        before: before ? { status: before } : null,
        after: { status: after },
        reason: reason ?? null,
        traceId,
      },
      tx,
    );
  }

  private publish(
    tx: Prisma.TransactionClient,
    type: string,
    refund: { id: string; orderId: string; paymentIntentId: string; amount: Prisma.Decimal; requestedById: string },
    actorId: string,
    traceId: string | undefined,
  ) {
    const payload: RefundEventPayload = {
      refundId: refund.id,
      orderId: refund.orderId,
      paymentIntentId: refund.paymentIntentId,
      amount: refund.amount.toString(),
      currency: 'IDR',
      requestedById: refund.requestedById,
    };
    return this.bus.publish(
      {
        type,
        aggregateType: REFUND_AGGREGATE,
        aggregateId: refund.id,
        dedupeKey: `${type}:${refund.id}`,
        payload,
        actorId,
        traceId: traceId ?? null,
      },
      tx,
    );
  }
}

