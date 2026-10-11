CREATE TABLE "GamificationLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "conceptId" TEXT,
    "topicId" TEXT,
    "subTopicId" TEXT,
    "reversalOf" TEXT,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GamificationLedger_idempotencyKey_key" ON "GamificationLedger"("idempotencyKey");

CREATE UNIQUE INDEX "GamificationLedger_reversalOf_key" ON "GamificationLedger"("reversalOf");

CREATE INDEX "GamificationLedger_userId_createdAt_idx" ON "GamificationLedger"("userId", "createdAt");

CREATE INDEX "GamificationLedger_userId_ruleId_conceptId_idx" ON "GamificationLedger"("userId", "ruleId", "conceptId");

ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_reversalOf_fkey" FOREIGN KEY ("reversalOf") REFERENCES "GamificationLedger"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_points_nonzero" CHECK ("points" <> 0);

ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_sign_matches_kind" CHECK (("reversalOf" IS NULL AND "points" > 0) OR ("reversalOf" IS NOT NULL AND "points" < 0));

ALTER TABLE "GamificationLedger" ADD CONSTRAINT "GamificationLedger_reversal_needs_reason_and_actor" CHECK ("reversalOf" IS NULL OR ("reason" IS NOT NULL AND "actorId" IS NOT NULL));

CREATE FUNCTION "gamification_ledger_no_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GamificationLedger is append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GamificationLedger_no_update" BEFORE UPDATE ON "GamificationLedger" FOR EACH ROW EXECUTE FUNCTION "gamification_ledger_no_update"();

CREATE FUNCTION "gamification_ledger_reversal_matches"() RETURNS trigger AS $$
DECLARE
  original "GamificationLedger"%ROWTYPE;
BEGIN
  IF NEW."reversalOf" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO original FROM "GamificationLedger" WHERE id = NEW."reversalOf";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reversal names an unknown ledger entry' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF original."userId" <> NEW."userId" OR original."reversalOf" IS NOT NULL OR original."points" + NEW."points" <> 0 THEN
    RAISE EXCEPTION 'reversal must equal minus an original entry of the same learner' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GamificationLedger_reversal_matches" BEFORE INSERT ON "GamificationLedger" FOR EACH ROW EXECUTE FUNCTION "gamification_ledger_reversal_matches"();
