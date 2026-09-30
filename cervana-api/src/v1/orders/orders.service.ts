import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentIntent, PaymentIntentStatus, Prisma } from '@prisma/client';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { CommerceConfig } from '../commerce/commerce.config';
import { computePlatformFee, money, sumMoney, ZERO } from '../commerce/money';
import { PaymentConfig } from '../payments/payment.config';
import { PaymentService } from '../payments/payment.service';
import { OrderCatalogService, RequestedItem, ResolvedLine } from './order-catalog.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { assertTransition } from './order-state';
import { CreateOrderRequestDtoType, OrderListQueryDtoType } from './orders.dto';
import { OrdersRepo } from './orders.repo';

const MINUTE_MS = 60 * 1000;

const PRESENTED_STATES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.CREATED,
  PaymentIntentStatus.PENDING,
  PaymentIntentStatus.SUBMITTED,
  PaymentIntentStatus.PROCESSING,
];

const itemSelect = {
  id: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  articleId: true,
  classId: true,
  topicId: true,
} satisfies Prisma.OrderItemSelect;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepo: OrdersRepo,
    private readonly prisma: PrismaService,
    private readonly catalog: OrderCatalogService,
    private readonly payments: PaymentService,
    private readonly paymentConfig: PaymentConfig,
    private readonly commerceConfig: CommerceConfig,
    private readonly lifecycle: OrderLifecycleService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: Actor, dto: CreateOrderRequestDtoType, traceId?: string) {
    return errorHandler(async () => {
      const requested = this.normalize(dto);

      const outcome = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`order-create:${actor.id}`}, 0))`;

          const lines = await this.catalog.resolve(tx, requested);

          if (lines.length === 1 && lines[0].kind === 'TOPIC' && lines[0].isFree) {
            return this.createFreeTopicOrder(tx, actor, lines[0], traceId);
          }
          if (lines.some((line) => line.isFree)) {
            throw new AppError(
              'Free products do not require an order',
              422,
              AppErrorCode.VALIDATION_ERROR,
            );
          }

          const currency = lines[0].currency;
          if (lines.some((line) => line.currency !== currency)) {
            throw new AppError(
              'An order cannot mix currencies',
              422,
              AppErrorCode.VALIDATION_ERROR,
            );
          }

          await this.assertNotOwned(tx, actor.id, lines);

          const duplicate = await this.findOpenDuplicate(tx, actor.id, lines);
          if (duplicate) {
            return { orderId: duplicate, created: false };
          }

          const percent = this.commerceConfig.platformFeePercent;
          const priced = lines.map((line) => ({
            line,
            fee: line.tenantId ? computePlatformFee(line.unitPrice, percent) : ZERO,
          }));
          const subtotal = sumMoney(priced.map(({ line }) => line.unitPrice));
          const platformFee = sumMoney(priced.map(({ fee }) => fee));
          const expiresAt = new Date(Date.now() + this.paymentConfig.intentTtlMinutes * MINUTE_MS);

          const order = await tx.order.create({
            data: {
              userId: actor.id,
              topicId: lines.length === 1 && lines[0].kind === 'TOPIC' ? lines[0].productId : null,
              subtotal,
              platformFee,
              total: subtotal,
              amount: Number(subtotal),
              currency,
              status: OrderStatus.PENDING,
              expiredAt: expiresAt,
              items: {
                create: priced.map(({ line, fee }) => ({
                  tenantId: line.tenantId,
                  articleId: line.kind === 'ARTICLE' ? line.productId : null,
                  classId: line.kind === 'CLASS' ? line.productId : null,
                  topicId: line.kind === 'TOPIC' ? line.productId : null,
                  quantity: 1,
                  unitPrice: line.unitPrice,
                  totalPrice: line.unitPrice,
                  platformFee: fee,
                })),
              },
            },
          });

          await this.payments.createIntent(tx, {
            order,
            buyerId: actor.id,
            amount: subtotal,
            currency,
            expiresAt,
            options: dto.paymentMethod ? { method: dto.paymentMethod } : undefined,
            actor: { kind: 'BUYER', id: actor.id, role: actor.role },
            traceId,
          });

          await this.audit.record(
            {
              actorId: actor.id,
              actorRole: actor.role,
              action: 'ORDER_CREATED',
              entityType: 'Order',
              entityId: order.id,
              after: {
                status: order.status,
                total: subtotal.toString(),
                currency,
                items: lines.map((line) => `${line.kind}:${line.productId}`),
              },
              traceId,
            },
            tx,
          );

          return { orderId: order.id, created: true };
        },
        { timeout: 20000 },
      );

      return {
        message: outcome.created ? 'Successfully created order' : 'Order already exists',
        data: await this.view(this.prisma, outcome.orderId),
      };
    });
  }

  async findAll(actor: Actor, query: OrderListQueryDtoType) {
    return errorHandler(async () => {
      const userId = this.policy.resolveUserScope(actor, query.userId);
      const result = await this.ordersRepo.list({ ...query, userId });
      return {
        message: 'Successfully retrieved orders',
        data: { data: result.data, pagination: result.meta },
      };
    });
  }

  async findOne(actor: Actor, id: string, include?: 'topic') {
    return errorHandler(async () => {
      const order = await this.ordersRepo.findById(id, include);
      if (!order || (order.userId !== actor.id && !this.policy.isAdmin(actor))) {
        throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
      }
      const intent = await this.payments.findLatestForOrder(this.prisma, id);
      return {
        message: 'Successfully retrieved order',
        data: { ...order, payment: intent ? this.paymentView(intent) : null },
      };
    });
  }

  async cancelOrder(actor: Actor, orderId: string, traceId?: string) {
    return errorHandler(async () => {
      const result = await this.prisma.$transaction(async (tx) => {
        const order = await this.lifecycle.lock(tx, orderId);
        if (order.userId !== actor.id && !this.policy.isAdmin(actor)) {
          throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
        }
        if (order.status === OrderStatus.CANCELLED) {
          return { order, changed: false };
        }
        assertTransition(order.status, OrderStatus.CANCELLED);

        const cancelled = await this.payments.cancelForOrder(tx, orderId, {
          actor: {
            kind: this.policy.isAdmin(actor) ? 'ADMIN' : 'BUYER',
            id: actor.id,
            role: actor.role,
          },
          traceId,
        });
        if (!cancelled) {
          await this.lifecycle.transition(tx, orderId, OrderStatus.CANCELLED, {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'ORDER_CANCELLED',
            traceId,
          });
        }
        return { order: await tx.order.findUniqueOrThrow({ where: { id: orderId } }), changed: true };
      });

      return {
        message: result.changed ? 'Order cancelled' : 'Order already cancelled',
        data: result.order,
      };
    });
  }

  private normalize(dto: CreateOrderRequestDtoType): RequestedItem[] {
    const raw: RequestedItem[] = dto.items ?? [{ type: 'TOPIC', id: dto.topicId! }];
    const seen = new Set<string>();
    return raw.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async assertNotOwned(tx: Prisma.TransactionClient, userId: string, lines: ResolvedLine[]) {
    const now = new Date();
    const productConditions: Prisma.EntitlementWhereInput[] = lines.map((line) =>
      line.kind === 'ARTICLE'
        ? { articleId: line.productId }
        : line.kind === 'CLASS'
          ? { classId: line.productId }
          : { topicId: line.productId },
    );

    const entitlement = await tx.entitlement.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: productConditions }],
      },
      select: { id: true },
    });

    const topicIds = lines.filter((line) => line.kind === 'TOPIC').map((line) => line.productId);
    const legacy = topicIds.length
      ? await tx.userTopic.findFirst({
          where: {
            userId,
            topicId: { in: topicIds },
            accessType: 'PURCHASED',
            OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
          },
          select: { id: true },
        })
      : null;

    if (entitlement || legacy) {
      throw new AppError('You already have access to this product', 409, AppErrorCode.ALREADY_OWNED);
    }
  }

  private async findOpenDuplicate(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: ResolvedLine[],
  ): Promise<string | null> {
    const wanted = new Set(lines.map((line) => `${line.kind}:${line.productId}`));
    const pending = await tx.order.findMany({
      where: { userId, status: OrderStatus.PENDING, expiredAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { items: { select: { articleId: true, classId: true, topicId: true } } },
    });

    for (const order of pending) {
      const keys = order.items.map((item) =>
        item.articleId ? `ARTICLE:${item.articleId}` : item.classId ? `CLASS:${item.classId}` : `TOPIC:${item.topicId}`,
      );
      if (keys.length === wanted.size && keys.every((key) => wanted.has(key))) {
        return order.id;
      }
    }
    return null;
  }

  private async createFreeTopicOrder(
    tx: Prisma.TransactionClient,
    actor: Actor,
    line: ResolvedLine,
    traceId?: string,
  ): Promise<{ orderId: string; created: boolean }> {
    const existing = await tx.order.findFirst({
      where: {
        userId: actor.id,
        topicId: line.productId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLED] },
      },
      select: { id: true },
    });
    if (existing) {
      return { orderId: existing.id, created: false };
    }

    const now = new Date();
    const order = await tx.order.create({
      data: {
        userId: actor.id,
        topicId: line.productId,
        subtotal: ZERO,
        platformFee: ZERO,
        total: ZERO,
        amount: 0,
        currency: line.currency,
        status: OrderStatus.FULFILLED,
        paidAt: now,
        expiredAt: now,
        items: {
          create: [
            {
              topicId: line.productId,
              quantity: 1,
              unitPrice: ZERO,
              totalPrice: ZERO,
              platformFee: ZERO,
            },
          ],
        },
      },
    });

    await tx.userTopic.upsert({
      where: { userId_topicId: { userId: actor.id, topicId: line.productId } },
      create: {
        userId: actor.id,
        topicId: line.productId,
        accessType: 'FREE',
        status: 'NOT_STARTED',
        progressPercent: 0,
        purchasedAt: now,
      },
      update: {},
    });

    await this.audit.record(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: order.id,
        after: { status: order.status, total: '0', free: true, items: [`TOPIC:${line.productId}`] },
        traceId,
      },
      tx,
    );

    return { orderId: order.id, created: true };
  }

  private async view(client: Pick<Prisma.TransactionClient, 'order' | 'paymentIntent'>, orderId: string) {
    const order = await client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { select: itemSelect } },
    });
    const intent = await this.payments.findLatestForOrder(client, orderId);
    return { ...order, payment: intent ? this.paymentView(intent) : null };
  }

  private paymentView(intent: PaymentIntent) {
    return {
      id: intent.id,
      provider: intent.provider,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      expiresAt: intent.expiresAt,
      paidAt: intent.paidAt,
      presentation: PRESENTED_STATES.includes(intent.status) ? this.payments.present(intent) : null,
    };
  }
}
