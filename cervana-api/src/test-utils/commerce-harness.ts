import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AuditService } from '@/common/authz/audit.service';
import { PolicyService } from '@/common/authz/policy.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { CommerceLedgerService } from '@/v1/commerce/commerce-ledger.service';
import { CommerceConfig } from '@/v1/commerce/commerce.config';
import { CreatorEarningsService } from '@/v1/commerce/creator-earnings.service';
import { CommerceFulfillmentService } from '@/v1/commerce/fulfillment/commerce-fulfillment.service';
import { ArticleAuthoringService } from '@/v1/articles/article-authoring.service';
import { PayoutsService } from '@/v1/payouts/payouts.service';
import { RefundsService } from '@/v1/refunds/refunds.service';
import { CommerceRefundService } from '@/v1/commerce/commerce-refund.service';
import { ClassAuthoringService } from '@/v1/classes/class-authoring.service';
import { ClassEnrollmentsService } from '@/v1/classes/class-enrollments.service';
import { ClassModerationService } from '@/v1/classes/class-moderation.service';
import { MarketplaceClassesService } from '@/v1/classes/marketplace-classes.service';
import { ArticleModerationService } from '@/v1/articles/article-moderation.service';
import { MarketplaceArticlesService } from '@/v1/articles/marketplace-articles.service';
import { EntitlementsService } from '@/v1/entitlements/entitlements.service';
import { LedgerService } from '@/v1/ledger/ledger.service';
import { WalletService } from '@/v1/ledger/wallet.service';
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
  const ledgerCore = new LedgerService();
  const wallets = new WalletService(prisma, policy);
  const earnings = new CreatorEarningsService(prisma, ledgerCore, wallets);
  const ledger = new CommerceLedgerService(ledgerCore);
  const classEnrollments = new ClassEnrollmentsService(prisma, audit, bus);
  const payouts = new PayoutsService(prisma, policy, audit, bus, ledgerCore, wallets, commerceConfig, uploads);
  const fulfillment = new CommerceFulfillmentService(
    bus,
    lifecycle,
    entitlements,
    earnings,
    ledger,
    audit,
    commerceConfig,
    classEnrollments,
  );

  const articleAuthoring = new ArticleAuthoringService(prisma, audit, uploads);
  const articleModeration = new ArticleModerationService(prisma, policy, audit, bus);
  const marketplaceArticles = new MarketplaceArticlesService(prisma, entitlements);
  const classAuthoring = new ClassAuthoringService(prisma, audit, uploads);
  const classModeration = new ClassModerationService(prisma, policy, audit, bus);
  const marketplaceClasses = new MarketplaceClassesService(prisma, entitlements);

  const refunds = new RefundsService(prisma, policy, audit, bus, commerceConfig, lifecycle, payments, registry, uploads);
  const commerceRefund = new CommerceRefundService(bus, lifecycle, ledgerCore, wallets, audit);

  lifecycle.onModuleInit();
  commerceRefund.onModuleInit();
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
    ledgerCore,
    wallets,
    articleAuthoring,
    articleModeration,
    marketplaceArticles,
    classAuthoring,
    classModeration,
    marketplaceClasses,
    classEnrollments,
    payouts,
    refunds,
  };
}

export type CommerceStack = ReturnType<typeof buildCommerceStack>;
