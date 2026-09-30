DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Refund") THEN
    RAISE EXCEPTION 'Refund contains rows without a payment intent; migrate them before applying this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "category" NOT IN ('ORDER_PAYMENT', 'PLATFORM_FEE', 'CREATOR_EARNING')) THEN
    RAISE EXCEPTION 'LedgerTransaction has entries whose direction cannot be inferred';
  END IF;
  IF EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "walletId" IS NOT NULL) THEN
    RAISE EXCEPTION 'LedgerTransaction already has wallet entries whose direction cannot be inferred';
  END IF;
  IF EXISTS (SELECT 1 FROM "ArticleVersion" v WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = v."createdById")) THEN
    RAISE EXCEPTION 'ArticleVersion has a createdById that is not a user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Article" a
    WHERE a."publishedVersionId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "ArticleVersion" v WHERE v."id" = a."publishedVersionId")
  ) THEN
    RAISE EXCEPTION 'Article.publishedVersionId points at a missing version';
  END IF;
END;
$$;

UPDATE "Order"
SET
  "subtotal" = COALESCE(
    "subtotal",
    CASE WHEN lower("currency") = 'usd' THEN round(COALESCE("amount", 0)::numeric / 100, 2) ELSE round(COALESCE("amount", 0)::numeric, 2) END
  ),
  "total" = COALESCE(
    "total",
    CASE WHEN lower("currency") = 'usd' THEN round(COALESCE("amount", 0)::numeric / 100, 2) ELSE round(COALESCE("amount", 0)::numeric, 2) END
  ),
  "platformFee" = COALESCE("platformFee", 0)
WHERE "subtotal" IS NULL OR "total" IS NULL OR "platformFee" IS NULL;

CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

ALTER TABLE "Order" DROP CONSTRAINT "Order_topicId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

DROP INDEX "Wallet_tenantId_currency_key";

ALTER TABLE "Article" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

ALTER TABLE "ClassProduct" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

ALTER TABLE "CreatorEarning" ADD COLUMN     "releasedAt" TIMESTAMP(3);

ALTER TABLE "LedgerTransaction" ADD COLUMN     "direction" "LedgerDirection" NOT NULL DEFAULT 'CREDIT',
ADD COLUMN     "traceId" TEXT;
ALTER TABLE "LedgerTransaction" ALTER COLUMN "direction" DROP DEFAULT;

INSERT INTO "LedgerTransaction" ("id", "category", "direction", "amount", "currency", "walletId", "idempotencyKey", "description")
SELECT gen_random_uuid()::text, 'ADJUSTMENT', 'CREDIT', w."balance", w."currency", w."id",
       'opening-balance:' || w."id", 'Opening balance recorded when the ledger became the source of wallet balances'
FROM "Wallet" w
WHERE w."balance" > 0;

ALTER TABLE "Order" ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "platformFee" SET NOT NULL,
ALTER COLUMN "platformFee" SET DEFAULT 0,
ALTER COLUMN "subtotal" SET NOT NULL,
ALTER COLUMN "subtotal" SET DEFAULT 0,
ALTER COLUMN "total" SET NOT NULL,
ALTER COLUMN "total" SET DEFAULT 0;

ALTER TABLE "Refund" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "paymentIntentId" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT;

CREATE INDEX "Article_status_submittedAt_idx" ON "Article"("status", "submittedAt");
CREATE INDEX "LedgerTransaction_payoutId_idx" ON "LedgerTransaction"("payoutId");
CREATE INDEX "LedgerTransaction_refundId_idx" ON "LedgerTransaction"("refundId");
CREATE INDEX "LedgerTransaction_earningId_idx" ON "LedgerTransaction"("earningId");
CREATE INDEX "Refund_paymentIntentId_status_idx" ON "Refund"("paymentIntentId", "status");
CREATE INDEX "Wallet_tenantId_idx" ON "Wallet"("tenantId");
CREATE UNIQUE INDEX "Wallet_ownerId_tenantId_currency_key" ON "Wallet"("ownerId", "tenantId", "currency");

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ArticleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassProduct" ADD CONSTRAINT "ClassProduct_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "CreatorEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_money_valid" CHECK ("subtotal" >= 0 AND "platformFee" >= 0 AND "total" >= 0 AND "platformFee" <= "total");

ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_direction_rules" CHECK (
  "reversalOfId" IS NOT NULL OR (
    ("category" = 'ORDER_PAYMENT' AND "direction" = 'CREDIT' AND "walletId" IS NULL) OR
    ("category" = 'PLATFORM_FEE' AND "direction" = 'CREDIT' AND "walletId" IS NULL) OR
    ("category" = 'CREATOR_EARNING' AND "direction" = 'CREDIT' AND "walletId" IS NULL) OR
    ("category" = 'WALLET_CREDIT' AND "direction" = 'CREDIT' AND "walletId" IS NOT NULL) OR
    ("category" = 'PAYOUT' AND "direction" = 'DEBIT' AND "walletId" IS NOT NULL) OR
    ("category" = 'REFUND' AND "direction" = 'DEBIT' AND "walletId" IS NULL) OR
    "category" = 'ADJUSTMENT'
  )
);

ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_reference_rules" CHECK (
  ("category" = 'ORDER_PAYMENT' AND "orderId" IS NOT NULL) OR
  ("category" IN ('PLATFORM_FEE', 'CREATOR_EARNING') AND "orderId" IS NOT NULL AND "earningId" IS NOT NULL) OR
  ("category" = 'WALLET_CREDIT' AND "earningId" IS NOT NULL) OR
  ("category" = 'PAYOUT' AND "payoutId" IS NOT NULL) OR
  ("category" = 'REFUND' AND "refundId" IS NOT NULL) OR
  "category" = 'ADJUSTMENT'
);

CREATE FUNCTION "validate_ledger_entry"() RETURNS trigger AS $$
DECLARE
  original RECORD;
BEGIN
  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT "category", "direction", "amount", "currency", "walletId", "reversalOfId" INTO original
    FROM "LedgerTransaction" WHERE "id" = NEW."reversalOfId";
    IF NOT FOUND OR original."reversalOfId" IS NOT NULL THEN
      RAISE EXCEPTION 'a reversal must reference an original ledger entry' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."category" <> original."category"
       OR NEW."amount" <> original."amount"
       OR NEW."currency" <> original."currency"
       OR NEW."walletId" IS DISTINCT FROM original."walletId"
       OR NEW."direction" = original."direction" THEN
      RAISE EXCEPTION 'a reversal must mirror the original entry with the opposite direction' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerTransaction_validate" BEFORE INSERT ON "LedgerTransaction" FOR EACH ROW EXECUTE FUNCTION "validate_ledger_entry"();

CREATE FUNCTION "apply_ledger_to_wallet"() RETURNS trigger AS $$
BEGIN
  IF NEW."walletId" IS NOT NULL THEN
    UPDATE "Wallet"
    SET "balance" = "balance" + CASE WHEN NEW."direction" = 'CREDIT' THEN NEW."amount" ELSE -NEW."amount" END,
        "updatedAt" = now()
    WHERE "id" = NEW."walletId" AND "currency" = NEW."currency";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ledger currency does not match the wallet' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerTransaction_apply_wallet" AFTER INSERT ON "LedgerTransaction" FOR EACH ROW EXECUTE FUNCTION "apply_ledger_to_wallet"();

CREATE FUNCTION "guard_wallet"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."balance" <> 0 THEN
      RAISE EXCEPTION 'a wallet starts empty; balances come from the ledger' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."ownerId" <> OLD."ownerId" OR NEW."tenantId" <> OLD."tenantId" OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'wallet ownership is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."balance" <> OLD."balance" AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'wallet balance can only change through the ledger' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Wallet_guard" BEFORE INSERT OR UPDATE ON "Wallet" FOR EACH ROW EXECUTE FUNCTION "guard_wallet"();

CREATE FUNCTION "guard_order"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'orders are financial history and cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."userId" <> OLD."userId"
     OR NEW."topicId" IS DISTINCT FROM OLD."topicId"
     OR NEW."subtotal" <> OLD."subtotal"
     OR NEW."platformFee" <> OLD."platformFee"
     OR NEW."total" <> OLD."total"
     OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'order pricing snapshot is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_guard" BEFORE UPDATE OR DELETE ON "Order" FOR EACH ROW EXECUTE FUNCTION "guard_order"();

CREATE FUNCTION "guard_order_item"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'order items are financial history and cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'order item pricing snapshot is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderItem_guard" BEFORE UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION "guard_order_item"();

ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_release_rules" CHECK ("status" <> 'AVAILABLE' OR "releasedAt" IS NOT NULL);

CREATE FUNCTION "guard_creator_earning"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'creator earnings are financial history and cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."tenantId" <> OLD."tenantId"
     OR NEW."creatorId" <> OLD."creatorId"
     OR NEW."orderId" <> OLD."orderId"
     OR NEW."orderItemId" <> OLD."orderItemId"
     OR NEW."grossAmount" <> OLD."grossAmount"
     OR NEW."platformFee" <> OLD."platformFee"
     OR NEW."creatorAmount" <> OLD."creatorAmount"
     OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'creator earning amounts are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."status" = 'REVERSED' AND NEW."status" <> 'REVERSED' THEN
    RAISE EXCEPTION 'a reversed earning cannot be reopened' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CreatorEarning_guard" BEFORE UPDATE OR DELETE ON "CreatorEarning" FOR EACH ROW EXECUTE FUNCTION "guard_creator_earning"();

ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_paid_at_matches_status" CHECK (("status" = 'PAID') = ("paidAt" IS NOT NULL));
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_review_recorded" CHECK ("status" NOT IN ('APPROVED', 'PAID', 'REJECTED') OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_rejection_reason" CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);

CREATE FUNCTION "guard_payout_request"() RETURNS trigger AS $$
DECLARE
  w RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payout requests are financial history and cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT "ownerId", "tenantId" INTO w FROM "Wallet" WHERE "id" = NEW."walletId";
    IF NOT FOUND OR w."ownerId" <> NEW."creatorId" OR w."tenantId" <> NEW."tenantId" THEN
      RAISE EXCEPTION 'a payout must draw on the creator wallet of the same tenant' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" IN ('PAID', 'REJECTED', 'CANCELLED') THEN
    RAISE EXCEPTION 'a closed payout request is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."creatorId" <> OLD."creatorId"
     OR NEW."tenantId" <> OLD."tenantId"
     OR NEW."walletId" <> OLD."walletId"
     OR NEW."amount" <> OLD."amount"
     OR NEW."destinationInfo" IS DISTINCT FROM OLD."destinationInfo" THEN
    RAISE EXCEPTION 'payout terms are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PayoutRequest_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PayoutRequest" FOR EACH ROW EXECUTE FUNCTION "guard_payout_request"();

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processed_at_matches_status" CHECK (("status" = 'PROCESSED') = ("processedAt" IS NOT NULL));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approval_recorded" CHECK ("status" NOT IN ('APPROVED', 'PROCESSED') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_rejection_reason" CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_evidence_when_processed" CHECK ("status" <> 'PROCESSED' OR "evidenceUrl" IS NOT NULL);

CREATE FUNCTION "guard_refund"() RETURNS trigger AS $$
DECLARE
  intent RECORD;
  committed NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'refunds are financial history and cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  SELECT "orderId", "amount", "status" INTO intent FROM "PaymentIntent" WHERE "id" = NEW."paymentIntentId" FOR UPDATE;
  IF NOT FOUND OR intent."orderId" <> NEW."orderId" THEN
    RAISE EXCEPTION 'a refund must reference the payment of its order' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('PROCESSED', 'REJECTED') THEN
      RAISE EXCEPTION 'a closed refund is immutable' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."orderId" <> OLD."orderId"
       OR NEW."paymentIntentId" <> OLD."paymentIntentId"
       OR NEW."amount" <> OLD."amount"
       OR NEW."requestedById" <> OLD."requestedById" THEN
      RAISE EXCEPTION 'refund terms are immutable' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  ELSIF intent."status" NOT IN ('PAID', 'REFUND_PENDING') THEN
    RAISE EXCEPTION 'only a paid payment can be refunded' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."status" IN ('REQUESTED', 'APPROVED', 'PROCESSED') THEN
    SELECT COALESCE(SUM("amount"), 0) INTO committed
    FROM "Refund"
    WHERE "paymentIntentId" = NEW."paymentIntentId"
      AND "status" IN ('REQUESTED', 'APPROVED', 'PROCESSED')
      AND "id" <> NEW."id";
    IF committed + NEW."amount" > intent."amount" THEN
      RAISE EXCEPTION 'refunds exceed the captured amount' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Refund_guard" BEFORE INSERT OR UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION "guard_refund"();

ALTER TABLE "Article" ADD CONSTRAINT "Article_published_has_version" CHECK ("status" <> 'PUBLISHED' OR ("publishedVersionId" IS NOT NULL AND "publishedAt" IS NOT NULL)) NOT VALID;

DO $$
BEGIN
  ALTER TABLE "Article" VALIDATE CONSTRAINT "Article_published_has_version";
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Article_published_has_version stays NOT VALID: existing rows violate it; it is enforced for every new or updated row';
END;
$$;

CREATE FUNCTION "validate_article_publication"() RETURNS trigger AS $$
DECLARE
  v RECORD;
BEGIN
  IF NEW."publishedVersionId" IS NOT NULL THEN
    SELECT "articleId", "publishedAt" INTO v FROM "ArticleVersion" WHERE "id" = NEW."publishedVersionId";
    IF NOT FOUND OR v."articleId" <> NEW."id" OR v."publishedAt" IS NULL THEN
      RAISE EXCEPTION 'publishedVersionId must reference a published version of the same article' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Article_validate_publication" BEFORE INSERT OR UPDATE OF "publishedVersionId" ON "Article" FOR EACH ROW EXECUTE FUNCTION "validate_article_publication"();
