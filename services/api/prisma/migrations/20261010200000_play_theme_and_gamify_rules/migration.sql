CREATE TYPE "RewardKind" AS ENUM ('XP', 'STAR');

ALTER TABLE "GamificationLedger" ADD COLUMN "kind" "RewardKind" NOT NULL DEFAULT 'XP';

CREATE INDEX "GamificationLedger_userId_kind_idx" ON "GamificationLedger"("userId", "kind");

CREATE OR REPLACE FUNCTION "gamification_ledger_reversal_matches"() RETURNS trigger AS $$
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
  IF original."userId" <> NEW."userId" OR original."kind" <> NEW."kind" OR original."reversalOf" IS NOT NULL OR original."points" + NEW."points" <> 0 THEN
    RAISE EXCEPTION 'reversal must equal minus an original entry of the same learner and kind' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "rewardKind" "RewardKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "dailyCap" INTEGER,
    "params" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardRule_code_version_key" ON "RewardRule"("code", "version");

ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_version_positive" CHECK ("version" >= 1);

ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_daily_cap_positive" CHECK ("dailyCap" IS NULL OR "dailyCap" >= 1);

CREATE FUNCTION "reward_rule_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."code" IS DISTINCT FROM OLD."code"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."eventType" IS DISTINCT FROM OLD."eventType"
    OR NEW."rewardKind" IS DISTINCT FROM OLD."rewardKind"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."dailyCap" IS DISTINCT FROM OLD."dailyCap"
    OR NEW."params" IS DISTINCT FROM OLD."params" THEN
    RAISE EXCEPTION 'RewardRule is immutable except active: a changed rule is a new version' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RewardRule_immutable" BEFORE UPDATE ON "RewardRule" FOR EACH ROW EXECUTE FUNCTION "reward_rule_immutable"();

CREATE TABLE "LevelThreshold" (
    "level" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,

    CONSTRAINT "LevelThreshold_pkey" PRIMARY KEY ("level")
);

CREATE UNIQUE INDEX "LevelThreshold_xp_key" ON "LevelThreshold"("xp");

ALTER TABLE "LevelThreshold" ADD CONSTRAINT "LevelThreshold_level_positive" CHECK ("level" >= 1);

ALTER TABLE "LevelThreshold" ADD CONSTRAINT "LevelThreshold_xp_non_negative" CHECK ("xp" >= 0);

ALTER TABLE "Achievement" ADD COLUMN "code" TEXT,
ADD COLUMN "iconName" TEXT,
ADD COLUMN "rule" JSONB,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
ADD COLUMN "streakFreezes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "leaderboardHandle" TEXT,
ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_leaderboardHandle_key" ON "User"("leaderboardHandle");

ALTER TABLE "User" ADD CONSTRAINT "User_streakFreezes_non_negative" CHECK ("streakFreezes" >= 0);

ALTER TABLE "User" ADD CONSTRAINT "User_leaderboardHandle_format" CHECK ("leaderboardHandle" IS NULL OR "leaderboardHandle" ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE "User" ADD CONSTRAINT "User_leaderboard_opt_in_needs_handle" CHECK (NOT "leaderboardOptIn" OR "leaderboardHandle" IS NOT NULL);
