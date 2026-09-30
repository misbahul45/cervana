import { Injectable } from '@nestjs/common';
import { LedgerCategory, LedgerDirection, PayoutRequest, PayoutStatus, Prisma, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { CommerceConfig } from '../commerce/commerce.config';
import { money } from '../commerce/money';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../ledger/wallet.service';
import { assertOwnedUploadedFile } from '../uploads/uploaded-file';
import { UploadsService } from '../uploads/uploads.service';
import { assertPayoutTransition } from './payout-state';
import { AdminPayoutQueryDtoType, MarkPaidDtoType, PayoutQueryDtoType, RequestPayoutDtoType } from './payouts.dto';

export const PayoutEvents = {
  Requested: 'PayoutRequested',
  Approved: 'PayoutApproved',
  Paid: 'PayoutPaid',
  Rejected: 'PayoutRejected',
  Cancelled: 'PayoutCancelled',
} as const;

const PAYOUT_AGGREGATE = 'PayoutRequest';

const creatorSelect = {
  id: true,
  amount: true,
  status: true,
  destinationInfo: true,
  requestedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  paidAt: true,
  evidenceUrl: true,
  walletId: true,
  tenantId: true,
} satisfies Prisma.PayoutRequestSelect;

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly config: CommerceConfig,
    private readonly uploads: UploadsService,
  ) {}

  async request(actor: Actor, dto: RequestPayoutDtoType, traceId?: string) {
    const amount = money(dto.amount);
    if (amount.lessThan(this.config.payoutMinAmount)) {
      throw new AppError(`The minimum payout is ${this.config.payoutMinAmount.toString()}`, 422, AppErrorCode.VALIDATION_ERROR);
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.pickWallet(tx, actor, dto.walletId);
      const locked = await this.wallets.lock(tx, wallet.id);
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: locked.tenantId }, select: { status: true } });
      if (tenant.status !== TenantStatus.ACTIVE) {
        throw new AppError('The tenant is not active', 409, AppErrorCode.TENANT_ACCESS_DENIED);
      }
      const open = await tx.payoutRequest.findFirst({
        where: { walletId: locked.id, status: { in: [PayoutStatus.REQUESTED, PayoutStatus.UNDER_REVIEW, PayoutStatus.APPROVED] } },
        select: { id: true },
      });
      if (open) {
        throw new AppError('Finish or cancel your open payout request first', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (money(locked.balance).lessThan(amount)) {
        throw new AppError('The payout is larger than the available balance', 409, AppErrorCode.PAYOUT_EXCEEDS_BALANCE);
      }

      const created = await tx.payoutRequest.create({
        data: {
          creatorId: actor.id,
          tenantId: locked.tenantId,
          walletId: locked.id,
          amount,
          destinationInfo: dto.destination,
          status: PayoutStatus.REQUESTED,
        },
        select: creatorSelect,
      });
      await this.ledger.post(tx, {
        category: LedgerCategory.PAYOUT,
        direction: LedgerDirection.DEBIT,
        amount,
        currency: locked.currency,
        walletId: locked.id,
        payoutId: created.id,
        idempotencyKey: `payout:${created.id}`,
        description: 'Funds held for a payout request',
        createdById: actor.id,
        traceId,
      });
      await this.record(tx, actor, locked.tenantId, 'PAYOUT_REQUESTED', created.id, null, PayoutStatus.REQUESTED, undefined, traceId);
      await this.publish(tx, PayoutEvents.Requested, created.id, locked.tenantId, actor.id, traceId, {
        payoutId: created.id,
        amount: amount.toString(),
        creatorId: actor.id,
      });
      return created;
    });
    return { message: 'Payout requested', data: payout };
  }

  async listMine(actor: Actor, query: PayoutQueryDtoType) {
    const where: Prisma.PayoutRequestWhereInput = { creatorId: actor.id, ...(query.status && { status: query.status }) };
    return this.page(where, query.page, query.limit, creatorSelect);
  }

  async findMine(actor: Actor, id: string) {
    const payout = await this.prisma.payoutRequest.findFirst({ where: { id, creatorId: actor.id }, select: creatorSelect });
    if (!payout) {
      throw new AppError('Payout not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved payout', data: payout };
  }

  async cancel(actor: Actor, id: string, traceId?: string) {
    return this.transition(actor, id, PayoutStatus.CANCELLED, 'PAYOUT_CANCELLED', traceId, {
      ownerOnly: true,
      reverse: true,
      event: PayoutEvents.Cancelled,
    });
  }

  async queue(actor: Actor, query: AdminPayoutQueryDtoType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.PayoutRequestWhereInput = {
      status: query.status ?? { in: [PayoutStatus.REQUESTED, PayoutStatus.UNDER_REVIEW, PayoutStatus.APPROVED] },
      ...(query.tenantId && { tenantId: query.tenantId }),
    };
    return this.page(where, query.page, query.limit, {
      ...creatorSelect,
      creator: { select: { id: true, name: true, email: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    }, { requestedAt: 'asc' });
  }

  async findOne(actor: Actor, id: string) {
    this.policy.assertAdmin(actor);
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id },
      select: {
        ...creatorSelect,
        reviewedById: true,
        creator: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
        wallet: { select: { id: true, balance: true, currency: true } },
      },
    });
    if (!payout) {
      throw new AppError('Payout not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved payout', data: payout };
  }

  startReview(actor: Actor, id: string, traceId?: string) {
    return this.transition(actor, id, PayoutStatus.UNDER_REVIEW, 'PAYOUT_REVIEW_STARTED', traceId, { adminOnly: true, review: true });
  }

  approve(actor: Actor, id: string, traceId?: string) {
    return this.transition(actor, id, PayoutStatus.APPROVED, 'PAYOUT_APPROVED', traceId, {
      adminOnly: true,
      review: true,
      event: PayoutEvents.Approved,
    });
  }

  reject(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.transition(actor, id, PayoutStatus.REJECTED, 'PAYOUT_REJECTED', traceId, {
      adminOnly: true,
      review: true,
      reverse: true,
      reason,
      event: PayoutEvents.Rejected,
    });
  }

  async markPaid(actor: Actor, id: string, dto: MarkPaidDtoType, traceId?: string) {
    assertOwnedUploadedFile(this.uploads, actor, dto.evidence, 'Evidence');
    return this.transition(actor, id, PayoutStatus.PAID, 'PAYOUT_PAID', traceId, {
      adminOnly: true,
      paid: { evidence: dto.evidence, note: dto.note },
      event: PayoutEvents.Paid,
    });
  }

  private async transition(
    actor: Actor,
    id: string,
    target: PayoutStatus,
    action: string,
    traceId: string | undefined,
    options: {
      adminOnly?: boolean;
      ownerOnly?: boolean;
      review?: boolean;
      reverse?: boolean;
      reason?: string;
      event?: string;
      paid?: { evidence: Prisma.InputJsonValue; note?: string };
    },
  ) {
    if (options.adminOnly) this.policy.assertAdmin(actor);

    const result = await this.prisma.$transaction(async (tx) => {
      const ref = await tx.payoutRequest.findUnique({ where: { id }, select: { walletId: true } });
      if (!ref) {
        throw new AppError('Payout not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.wallets.lock(tx, ref.walletId);
      await tx.$queryRaw`SELECT id FROM "PayoutRequest" WHERE id = ${id} FOR UPDATE`;
      const payout = await tx.payoutRequest.findUniqueOrThrow({ where: { id } });

      if (options.ownerOnly && payout.creatorId !== actor.id) {
        throw new AppError('Payout not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (options.adminOnly && payout.creatorId === actor.id) {
        throw new AppError('You cannot review your own payout', 403, AppErrorCode.OWNERSHIP_DENIED);
      }
      if (payout.status === target) {
        return { payout, changed: false };
      }
      assertPayoutTransition(payout.status, target);

      const now = new Date();
      const updated = await tx.payoutRequest.update({
        where: { id },
        data: {
          status: target,
          ...(options.review && { reviewedById: actor.id, reviewedAt: now }),
          ...(options.reason && { rejectionReason: options.reason }),
          ...(options.paid && { paidAt: now, evidenceUrl: options.paid.evidence }),
        },
        select: creatorSelect,
      });

      if (options.reverse) {
        const original = await tx.ledgerTransaction.findFirst({
          where: { payoutId: id, category: LedgerCategory.PAYOUT, reversalOfId: null },
          select: { id: true },
        });
        if (original) {
          await this.ledger.reverse(tx, original.id, {
            idempotencyKey: `payout-reversal:${id}`,
            description: target === PayoutStatus.CANCELLED ? 'Payout cancelled' : 'Payout rejected',
            createdById: actor.id,
            traceId,
          });
        }
      }

      await this.record(tx, actor, payout.tenantId, action, id, payout.status, target, options.reason ?? options.paid?.note, traceId);
      if (options.event) {
        await this.publish(tx, options.event, id, payout.tenantId, actor.id, traceId, {
          payoutId: id,
          amount: payout.amount.toString(),
          creatorId: payout.creatorId,
        });
      }
      return { payout: updated, changed: true };
    });

    return {
      message: result.changed ? 'Payout updated' : 'Payout already in the requested state',
      data: result.payout,
    };
  }

  private async pickWallet(tx: Prisma.TransactionClient, actor: Actor, walletId?: string) {
    if (walletId) {
      const wallet = await tx.wallet.findFirst({ where: { id: walletId, ownerId: actor.id } });
      if (!wallet) {
        throw new AppError('Wallet not found', 404, AppErrorCode.NOT_FOUND);
      }
      return wallet;
    }
    const wallets = await tx.wallet.findMany({ where: { ownerId: actor.id } });
    if (wallets.length === 0) {
      throw new AppError('You have no wallet yet', 404, AppErrorCode.NOT_FOUND);
    }
    if (wallets.length > 1) {
      throw new AppError('Choose the wallet to withdraw from', 400, AppErrorCode.VALIDATION_ERROR);
    }
    return wallets[0];
  }

  private async page(
    where: Prisma.PayoutRequestWhereInput,
    page: number,
    limit: number,
    select: Prisma.PayoutRequestSelect,
    orderBy: Prisma.PayoutRequestOrderByWithRelationInput = { requestedAt: 'desc' },
  ) {
    const [data, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.payoutRequest.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved payouts',
      data: { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    };
  }

  private record(
    tx: Prisma.TransactionClient,
    actor: Actor,
    tenantId: string,
    action: string,
    id: string,
    before: PayoutStatus | null,
    after: PayoutStatus,
    reason: string | undefined,
    traceId: string | undefined,
  ) {
    return this.audit.record(
      {
        actorId: actor.id,
        actorRole: actor.role,
        tenantId,
        action,
        entityType: 'PayoutRequest',
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
    id: string,
    tenantId: string,
    actorId: string,
    traceId: string | undefined,
    payload: { payoutId: string; amount: string; creatorId: string },
  ) {
    return this.bus.publish(
      {
        type,
        aggregateType: PAYOUT_AGGREGATE,
        aggregateId: id,
        dedupeKey: `${type}:${id}`,
        payload,
        tenantId,
        actorId,
        traceId: traceId ?? null,
      },
      tx,
    );
  }
}

export type { PayoutRequest };
