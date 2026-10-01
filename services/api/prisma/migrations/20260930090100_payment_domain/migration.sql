DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ManualPaymentSubmission") THEN
    RAISE EXCEPTION 'ManualPaymentSubmission contains rows without a payment intent; migrate them before applying this migration';
  END IF;
END;
$$;

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'STRIPE', 'MIDTRANS', 'XENDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('AUTHORIZATION', 'CAPTURE', 'SETTLEMENT', 'REFUND', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- DropIndex
DROP INDEX "Order_userId_topicId_status_key";

-- AlterTable
ALTER TABLE "ManualPaymentSubmission" ADD COLUMN     "paymentIntentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "providerPaymentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "type" "PaymentTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "externalReference" TEXT,
    "providerTransactionId" TEXT,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "rawReference" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "traceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentIntent_orderId_status_idx" ON "PaymentIntent"("orderId", "status");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_expiresAt_idx" ON "PaymentIntent"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_provider_providerPaymentId_key" ON "PaymentIntent"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentIntentId_createdAt_idx" ON "PaymentTransaction"("paymentIntentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_paymentIntentId_type_providerTransaction_key" ON "PaymentTransaction"("paymentIntentId", "type", "providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_dedupeKey_key" ON "DomainEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "DomainEvent_type_occurredAt_idx" ON "DomainEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateType_aggregateId_idx" ON "DomainEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "ManualPaymentSubmission_paymentIntentId_status_idx" ON "ManualPaymentSubmission"("paymentIntentId", "status");

-- CreateIndex
CREATE INDEX "Order_userId_topicId_idx" ON "Order"("userId", "topicId");

-- AddForeignKey
ALTER TABLE "ManualPaymentSubmission" ADD CONSTRAINT "ManualPaymentSubmission_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_paid_at_matches_status" CHECK (("status" IN ('PAID', 'REFUND_PENDING', 'REFUNDED')) = ("paidAt" IS NOT NULL));
CREATE UNIQUE INDEX "PaymentIntent_one_live_per_order" ON "PaymentIntent"("orderId") WHERE "status" IN ('CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'PAID', 'REFUND_PENDING');

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_amount_positive" CHECK ("amount" > 0);
CREATE UNIQUE INDEX "PaymentTransaction_one_successful_capture" ON "PaymentTransaction"("paymentIntentId") WHERE "type" = 'CAPTURE' AND "status" = 'SUCCEEDED';

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_fee_within_total" CHECK ("platformFee" >= 0 AND "platformFee" <= "totalPrice");

CREATE UNIQUE INDEX "ManualPaymentSubmission_one_open_per_intent" ON "ManualPaymentSubmission"("paymentIntentId") WHERE "status" IN ('SUBMITTED', 'UNDER_REVIEW');
CREATE UNIQUE INDEX "ManualPaymentSubmission_one_approved_per_intent" ON "ManualPaymentSubmission"("paymentIntentId") WHERE "status" = 'APPROVED';

CREATE TRIGGER "PaymentTransaction_append_only" BEFORE UPDATE OR DELETE ON "PaymentTransaction" FOR EACH ROW EXECUTE FUNCTION "forbid_row_mutation"();
CREATE TRIGGER "DomainEvent_append_only" BEFORE UPDATE OR DELETE ON "DomainEvent" FOR EACH ROW EXECUTE FUNCTION "forbid_row_mutation"();

CREATE FUNCTION "protect_payment_intent"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PaymentIntent cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."orderId" <> OLD."orderId" OR NEW."provider" <> OLD."provider" OR NEW."amount" <> OLD."amount" OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'PaymentIntent terms are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."status" IN ('FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'PaymentIntent in a terminal state cannot change' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentIntent_protect" BEFORE UPDATE OR DELETE ON "PaymentIntent" FOR EACH ROW EXECUTE FUNCTION "protect_payment_intent"();

CREATE FUNCTION "protect_manual_payment_submission"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ManualPaymentSubmission cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."status" IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'reviewed ManualPaymentSubmission is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."orderId" <> OLD."orderId" OR NEW."paymentIntentId" <> OLD."paymentIntentId" OR NEW."payerId" <> OLD."payerId" OR NEW."amount" <> OLD."amount" OR NEW."proofUrl" IS DISTINCT FROM OLD."proofUrl" THEN
    RAISE EXCEPTION 'ManualPaymentSubmission evidence is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManualPaymentSubmission_protect" BEFORE UPDATE OR DELETE ON "ManualPaymentSubmission" FOR EACH ROW EXECUTE FUNCTION "protect_manual_payment_submission"();
