
-- CreateTable
CREATE TABLE "SandboxAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxPeriod" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxTransaction" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxJournalLine" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "SandboxJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxAccount_code_key" ON "SandboxAccount"("code");

-- CreateIndex
CREATE INDEX "SandboxAccount_type_idx" ON "SandboxAccount"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPeriod_label_key" ON "SandboxPeriod"("label");

-- CreateIndex
CREATE INDEX "SandboxTransaction_attemptId_idx" ON "SandboxTransaction"("attemptId");

-- CreateIndex
CREATE INDEX "SandboxTransaction_periodId_idx" ON "SandboxTransaction"("periodId");

-- CreateIndex
CREATE INDEX "SandboxJournalLine_transactionId_idx" ON "SandboxJournalLine"("transactionId");

-- CreateIndex
CREATE INDEX "SandboxJournalLine_debitAccountId_idx" ON "SandboxJournalLine"("debitAccountId");

-- CreateIndex
CREATE INDEX "SandboxJournalLine_creditAccountId_idx" ON "SandboxJournalLine"("creditAccountId");

-- CreateIndex
CREATE INDEX "SandboxAttempt_userId_idx" ON "SandboxAttempt"("userId");

-- AddForeignKey
ALTER TABLE "SandboxTransaction" ADD CONSTRAINT "SandboxTransaction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SandboxAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxTransaction" ADD CONSTRAINT "SandboxTransaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SandboxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxJournalLine" ADD CONSTRAINT "SandboxJournalLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "SandboxTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxJournalLine" ADD CONSTRAINT "SandboxJournalLine_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "SandboxAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxJournalLine" ADD CONSTRAINT "SandboxJournalLine_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "SandboxAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxAttempt" ADD CONSTRAINT "SandboxAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxAttempt" ADD CONSTRAINT "SandboxAttempt_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "SandboxScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Sandbox invariants
ALTER TABLE "SandboxJournalLine"
  ADD CONSTRAINT "SandboxJournalLine_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "SandboxJournalLine"
  ADD CONSTRAINT "SandboxJournalLine_distinct_accounts" CHECK ("debitAccountId" <> "creditAccountId");
