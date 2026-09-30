import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AuditService } from '@/common/authz/audit.service';
import { PolicyService } from '@/common/authz/policy.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { CommerceLedgerService } from '@/v1/commerce/commerce-ledger.service';
import { CommerceConfig } from '@/v1/commerce/commerce.config';
import { CreatorEarningsService } from '@/v1/commerce/creator-earnings.service';
import { CommerceFulfillmentService } from '@/v1/commerce/fulfillment/commerce-fulfillment.service';
import { EntitlementsService } from '@/v1/entitlements/entitlements.service';
import { OrderCatalogService } from '@/v1/orders/order-catalog.service';
import { OrderLifecycleService } from '@/v1/orders/order-lifecycle.service';
import { OrdersRepo } from '@/v1/orders/orders.repo';
import { OrdersService } from '@/v1/orders/orders.service';
import { PaymentConfig } from '@/v1/payments/payment.config';
import { PaymentProviderRegistry } from '@/v1/payments/payment-provider.registry';
import { PaymentService } from '@/v1/payments/payment.service';
import { PaymentProviderAdapter } from '@/v1/payments/payment.types';
import { ManualPaymentProvider } from '@/v1/payments/providers/manual/manual-payment.provider';
import { ManualPaymentService } from '@/v1/payments/providers/manual/manual-payment.service';

export const TEST_MANUAL_ACCOUNTS = JSON.stringify([
  { method: 'BANK_TRANSFER', label: 'Bank transfer', accountNumber: '1234567890', accountName: 'Cervana Platform' },
  { method: 'QRIS', label: 'QRIS', accountNumber: 'QRIS-CERVANA', accountName: 'Cervana Platform' },
]);

export interface CommerceStackOptions {
  env?: Record<string, string>;
  extraAdapters?: PaymentProviderAdapter[];
  ownsFile?: (actor: { id: string; role: string }, fileId: string) => boolean;
}

export function buildCommerceStack(options: CommerceStackOptions = {}) {
  const env = {
    PAYMENT_PROVIDER: 'manual',
    PLATFORM_FEE_PERCENT: '10',
    MANUAL_PAYMENT_ACCOUNTS: TEST_MANUAL_ACCOUNTS,
    ...options.env,
  };
  const config = new ConfigService(env);
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const policy = new PolicyService();
  const bus = new DomainEventBus();
  const paymentConfig = new PaymentConfig(config);
  const commerceConfig = new CommerceConfig(config);
  const manualProvider = new ManualPaymentProvider(paymentConfig);
  const registry = new PaymentProviderRegistry([manualProvider, ...(options.extraAdapters ?? [])], paymentConfig);
  const payments = new PaymentService(prisma, registry, bus, audit);
  const uploads = { ownsFile: options.ownsFile ?? (() => true) } as never;
  const manual = new ManualPaymentService(prisma, payments, paymentConfig, policy, audit, uploads);
  const lifecycle = new OrderLifecycleService(bus, audit);
  const catalog = new OrderCatalogService();
  const ordersRepo = new OrdersRepo(prisma);
  const orders = new OrdersService(
    ordersRepo,
    prisma,
    catalog,
    payments,
    paymentConfig,
    commerceConfig,
    lifecycle,
    policy,
    audit,
  );
  const entitlements = new EntitlementsService();
  const earnings = new CreatorEarningsService();
  const ledger = new CommerceLedgerService();
  const fulfillment = new CommerceFulfillmentService(bus, lifecycle, entitlements, earnings, ledger, audit);

  lifecycle.onModuleInit();
  fulfillment.onModuleInit();

  return {
    prisma,
    audit,
    policy,
    bus,
    paymentConfig,
    commerceConfig,
    registry,
    payments,
    manual,
    lifecycle,
    orders,
    fulfillment,
    entitlements,
    earnings,
    ledger,
  };
}

export type CommerceStack = ReturnType<typeof buildCommerceStack>;
