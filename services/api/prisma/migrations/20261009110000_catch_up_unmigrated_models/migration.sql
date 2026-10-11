DO $$ BEGIN
    CREATE TYPE "SimulatorCompanyStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "FinancialStatementType" AS ENUM ('INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationPurpose" AS ENUM ('PURCHASE_CREDITS', 'PURCHASE_CLASS', 'PAYOUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'COMMITTED', 'RELEASED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SkillNodeState" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'MASTERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "EventAction" AS ENUM ('LESSON_COMPLETED', 'QUIZ_SUBMITTED', 'PURCHASE_COMPLETED', 'PAYOUT_RELEASED', 'BADGE_ISSUED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "EngagementWindow" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'RESTORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'REVIEWER';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "creditPackageId" TEXT;

ALTER TABLE "TeacherApplication" ADD COLUMN IF NOT EXISTS "expertiseTopicId" TEXT;

CREATE TABLE IF NOT EXISTS "VirtualCompany" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenarioSlug" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SimulatorCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ledger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "debitTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialStatement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "statementType" "FinancialStatementType" NOT NULL,
    "data" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditAmount" DECIMAL(14,2) NOT NULL,
    "priceAmount" DECIMAL(14,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'IDR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "purpose" "ReservationPurpose" NOT NULL,
    "referenceId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HoldWindow" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "openRefunds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoldWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RevenueShareRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformFeePct" DECIMAL(5,2) NOT NULL,
    "creatorPct" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),

    CONSTRAINT "RevenueShareRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdaptivePolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "nextActivityId" TEXT,
    "rationale" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SkillNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "state" "SkillNodeState" NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "EventAction" NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "piiRedacted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EngagementMetric" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "window" "EngagementWindow" NOT NULL,
    "uniqueUsers" INTEGER NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreatorOutcomeMetric" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "satisfaction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorOutcomeMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BackupRecord" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageUri" TEXT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VirtualCompany_tenantId_ownerId_idx" ON "VirtualCompany"("tenantId", "ownerId");

CREATE INDEX IF NOT EXISTS "VirtualCompany_scenarioSlug_idx" ON "VirtualCompany"("scenarioSlug");

CREATE INDEX IF NOT EXISTS "JournalEntry_companyId_date_idx" ON "JournalEntry"("companyId", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "Ledger_companyId_accountName_period_key" ON "Ledger"("companyId", "accountName", "period");

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialStatement_companyId_period_statementType_key" ON "FinancialStatement"("companyId", "period", "statementType");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPackage_slug_key" ON "CreditPackage"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_idempotencyKey_key" ON "Reservation"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "Reservation_userId_status_idx" ON "Reservation"("userId", "status");

CREATE INDEX IF NOT EXISTS "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HoldWindow_payoutId_key" ON "HoldWindow"("payoutId");

CREATE INDEX IF NOT EXISTS "HoldWindow_releaseAt_released_idx" ON "HoldWindow"("releaseAt", "released");

CREATE INDEX IF NOT EXISTS "RevenueShareRule_tenantId_effectiveFrom_idx" ON "RevenueShareRule"("tenantId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "AdaptivePolicy_userId_appliedAt_idx" ON "AdaptivePolicy"("userId", "appliedAt");

CREATE INDEX IF NOT EXISTS "SkillNode_userId_state_idx" ON "SkillNode"("userId", "state");

CREATE UNIQUE INDEX IF NOT EXISTS "SkillNode_userId_topicId_key" ON "SkillNode"("userId", "topicId");

CREATE INDEX IF NOT EXISTS "EventLog_action_createdAt_idx" ON "EventLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "EventLog_userId_createdAt_idx" ON "EventLog"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "MasterySnapshot_userId_snapshotAt_idx" ON "MasterySnapshot"("userId", "snapshotAt");

CREATE INDEX IF NOT EXISTS "MasterySnapshot_topicId_snapshotAt_idx" ON "MasterySnapshot"("topicId", "snapshotAt");

CREATE INDEX IF NOT EXISTS "EngagementMetric_cohortId_window_idx" ON "EngagementMetric"("cohortId", "window");

CREATE UNIQUE INDEX IF NOT EXISTS "EngagementMetric_cohortId_window_createdAt_key" ON "EngagementMetric"("cohortId", "window", "createdAt");

CREATE INDEX IF NOT EXISTS "CreatorOutcomeMetric_creatorId_windowStart_idx" ON "CreatorOutcomeMetric"("creatorId", "windowStart");

CREATE INDEX IF NOT EXISTS "RateLimit_scope_windowStart_idx" ON "RateLimit"("scope", "windowStart");

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_userId_scope_windowStart_key" ON "RateLimit"("userId", "scope", "windowStart");

CREATE UNIQUE INDEX IF NOT EXISTS "BackupRecord_tag_key" ON "BackupRecord"("tag");

CREATE INDEX IF NOT EXISTS "BackupRecord_status_startedAt_idx" ON "BackupRecord"("status", "startedAt");

DO $$ BEGIN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_creditPackageId_fkey" FOREIGN KEY ("creditPackageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "VirtualCompany" ADD CONSTRAINT "VirtualCompany_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "VirtualCompany" ADD CONSTRAINT "VirtualCompany_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "VirtualCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "VirtualCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FinancialStatement" ADD CONSTRAINT "FinancialStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "VirtualCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HoldWindow" ADD CONSTRAINT "HoldWindow_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PayoutRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RevenueShareRule" ADD CONSTRAINT "RevenueShareRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AdaptivePolicy" ADD CONSTRAINT "AdaptivePolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MasterySnapshot" ADD CONSTRAINT "MasterySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorOutcomeMetric" ADD CONSTRAINT "CreatorOutcomeMetric_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RateLimit" ADD CONSTRAINT "RateLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
