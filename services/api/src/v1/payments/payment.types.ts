import { PaymentIntent, PaymentIntentStatus, PaymentProvider, Prisma } from '@prisma/client';

export interface PaymentProviderCapabilities {
  supportsCheckout: boolean;
  supportsWebhook: boolean;
  supportsRefund: boolean;
  supportsCapture: boolean;
  supportsPartialRefund: boolean;
}

export interface PaymentPresentation {
  type: string;
  data: Record<string, unknown>;
}

export interface PaymentMethodOption {
  method: string;
  label: string;
}

export interface AdapterContext {
  tx: Prisma.TransactionClient;
  traceId?: string;
}

export interface CreatePaymentIntentInput {
  orderId: string;
  buyerId: string;
  amount: Prisma.Decimal;
  currency: string;
  expiresAt: Date;
  options?: Record<string, unknown>;
}

export interface CreatePaymentIntentResult {
  providerPaymentId: string | null;
  metadata: Prisma.InputJsonObject;
}

export interface PaymentStatusSnapshot {
  status: PaymentIntentStatus;
  providerStatus: string | null;
  observedAt: Date;
}

export interface CancelPaymentResult {
  allowed: boolean;
  reason?: string;
}

export interface RefundPaymentInput {
  amount: Prisma.Decimal;
  reason: string;
}

export interface RefundPaymentResult {
  mode: 'MANUAL' | 'PROVIDER';
  providerRefundId: string | null;
  status: 'PENDING' | 'SUCCEEDED';
  instructions?: string;
}

export interface ReconcilePaymentResult {
  providerStatus: string | null;
  consistent: boolean;
  discrepancies: string[];
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  readonly capabilities: PaymentProviderCapabilities;
  listMethods(): PaymentMethodOption[];
  createPaymentIntent(ctx: AdapterContext, input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  presentPayment(intent: PaymentIntent): PaymentPresentation;
  getPaymentStatus(ctx: AdapterContext, intent: PaymentIntent): Promise<PaymentStatusSnapshot>;
  cancelPayment(ctx: AdapterContext, intent: PaymentIntent): Promise<CancelPaymentResult>;
  refundPayment(ctx: AdapterContext, intent: PaymentIntent, input: RefundPaymentInput): Promise<RefundPaymentResult>;
  reconcilePayment(ctx: AdapterContext, intent: PaymentIntent): Promise<ReconcilePaymentResult>;
}

export const PAYMENT_PROVIDER_ADAPTERS = Symbol('PAYMENT_PROVIDER_ADAPTERS');

export interface VerifiedPaymentDraft {
  providerTransactionId: string;
  externalReference: string | null;
  rawReference: Prisma.InputJsonObject;
}

export interface PaymentActorRef {
  kind: 'ADMIN' | 'PROVIDER' | 'SYSTEM' | 'BUYER';
  id: string | null;
  role?: import('@prisma/client').Role | null;
}

export interface PaymentTransitionContext {
  actor: PaymentActorRef;
  reason?: string;
  traceId?: string;
}
