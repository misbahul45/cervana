-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "MisconceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'DECAYING', 'SUPERSEDED', 'INVALIDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'EXPERIMENTAL', 'VALIDATED', 'ACTIVE', 'REJECTED', 'ROLLED_BACK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OptimizationDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DEFERRED');

-- -----------------------------------------------------------------------------
-- Learner state
-- -----------------------------------------------------------------------------

CREATE TABLE "LearnerGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "targetMastery" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "deadline" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearnerGoal_userId_status_idx" ON "LearnerGoal"("userId", "status");

CREATE TABLE "TopicMasteryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastObservedAt" TIMESTAMP(3),
    "lastDecayedAt" TIMESTAMP(3),

    CONSTRAINT "TopicMasteryRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TopicMasteryRecord_userId_topicId_key" ON "TopicMasteryRecord"("userId", "topicId");

CREATE TABLE "StepMasteryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastScore" DOUBLE PRECISION,
    "lastAttemptedAt" TIMESTAMP(3),
    "hintUsedLast" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StepMasteryRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StepMasteryRecord_userId_stepId_key" ON "StepMasteryRecord"("userId", "stepId");

CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MisconceptionStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Misconception_userId_conceptKey_key" ON "Misconception"("userId", "conceptKey");

CREATE TABLE "LearningPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "explanationStyle" TEXT,
    "problemStyle" TEXT,
    "pace" TEXT,
    "hintTolerance" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningPreference_userId_key" ON "LearningPreference"("userId");

CREATE TABLE "BehavioralSignals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hintsPerQuestionAvg" DOUBLE PRECISION,
    "responseTimeAvgSec" DOUBLE PRECISION,
    "skipRate" DOUBLE PRECISION,
    "retryRate" DOUBLE PRECISION,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehavioralSignals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BehavioralSignals_userId_key" ON "BehavioralSignals"("userId");

-- -----------------------------------------------------------------------------
-- Memory
-- -----------------------------------------------------------------------------

CREATE TABLE "EpisodicMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lessonId" TEXT,
    "stepId" TEXT,
    "topicId" TEXT,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodicMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EpisodicMemory_userId_status_idx" ON "EpisodicMemory"("userId", "status");
CREATE INDEX "EpisodicMemory_userId_topicId_status_idx" ON "EpisodicMemory"("userId", "topicId", "status");

CREATE TABLE "SemanticLearnerMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traitKey" TEXT NOT NULL,
    "traitValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "sourceMemoryIds" JSONB NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemanticLearnerMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SemanticLearnerMemory_userId_traitKey_key" ON "SemanticLearnerMemory"("userId", "traitKey");

CREATE TABLE "ProceduralMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyKey" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "observedSuccessRate" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "ProceduralMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProceduralMemory_userId_strategyKey_key" ON "ProceduralMemory"("userId", "strategyKey");

-- -----------------------------------------------------------------------------
-- Events and episodes
-- -----------------------------------------------------------------------------

CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningEvent_userId_eventType_createdAt_idx" ON "LearningEvent"("userId", "eventType", "createdAt");

CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "retrievedChunks" JSONB NOT NULL,
    "retrievedMemory" JSONB NOT NULL,
    "strategy" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "evaluationScore" DOUBLE PRECISION,
    "evaluationJson" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,6),
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Episode_userId_createdAt_idx" ON "Episode"("userId", "createdAt");
CREATE INDEX "Episode_createdAt_idx" ON "Episode"("createdAt");

CREATE TABLE "InteractionEvaluation" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "correctness" DOUBLE PRECISION,
    "grounding" DOUBLE PRECISION,
    "pedagogy" DOUBLE PRECISION,
    "personalization" DOUBLE PRECISION,
    "difficultyAlign" DOUBLE PRECISION,
    "hallucination" DOUBLE PRECISION,
    "safety" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "judgeModel" TEXT NOT NULL,
    "judgeVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InteractionEvaluation_episodeId_key" ON "InteractionEvaluation"("episodeId");

-- -----------------------------------------------------------------------------
-- Prompts, policies, experiments
-- -----------------------------------------------------------------------------

CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "metricsJson" JSONB,
    "parentVersionId" TEXT,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromptVersion_name_version_key" ON "PromptVersion"("name", "version");
CREATE INDEX "PromptVersion_name_status_idx" ON "PromptVersion"("name", "status");

CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parametersJson" JSONB NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "metricsJson" JSONB,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyVersion_name_version_key" ON "PolicyVersion"("name", "version");

CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "armsJson" JSONB NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentRun" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "armName" TEXT NOT NULL,
    "userId" TEXT,
    "metricsJson" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "examplesJson" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationDataset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvaluationDataset_name_key" ON "EvaluationDataset"("name");
CREATE UNIQUE INDEX "EvaluationDataset_name_version_key" ON "EvaluationDataset"("name", "version");

CREATE TABLE "OptimizationRun" (
    "id" TEXT NOT NULL,
    "optimizerName" TEXT NOT NULL,
    "basePromptVersionId" TEXT,
    "candidateJson" JSONB NOT NULL,
    "baseMetricsJson" JSONB NOT NULL,
    "candidateMetricsJson" JSONB NOT NULL,
    "decision" "OptimizationDecision" NOT NULL,
    "rationale" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptimizationRun_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- Decision trace
-- -----------------------------------------------------------------------------

CREATE TABLE "DecisionTrace" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "taskId" TEXT,
    "agentVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "strategyJson" JSONB NOT NULL,
    "retrievedMemory" JSONB NOT NULL,
    "retrievedChunks" JSONB NOT NULL,
    "responseText" TEXT NOT NULL,
    "evaluationJson" JSONB,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionTrace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecisionTrace_traceId_key" ON "DecisionTrace"("traceId");
CREATE INDEX "DecisionTrace_userId_createdAt_idx" ON "DecisionTrace"("userId", "createdAt");

-- -----------------------------------------------------------------------------
-- Human override
-- -----------------------------------------------------------------------------

CREATE TABLE "TeacherOverride" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeValue" JSONB NOT NULL,
    "afterValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherOverride_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- Foreign keys
-- -----------------------------------------------------------------------------

ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT;

ALTER TABLE "TopicMasteryRecord" ADD CONSTRAINT "TopicMasteryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "TopicMasteryRecord" ADD CONSTRAINT "TopicMasteryRecord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE;

ALTER TABLE "StepMasteryRecord" ADD CONSTRAINT "StepMasteryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "StepMasteryRecord" ADD CONSTRAINT "StepMasteryRecord_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE;

ALTER TABLE "Misconception" ADD CONSTRAINT "Misconception_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "LearningPreference" ADD CONSTRAINT "LearningPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "BehavioralSignals" ADD CONSTRAINT "BehavioralSignals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "EpisodicMemory" ADD CONSTRAINT "EpisodicMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "SemanticLearnerMemory" ADD CONSTRAINT "SemanticLearnerMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "ProceduralMemory" ADD CONSTRAINT "ProceduralMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "Episode" ADD CONSTRAINT "Episode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "InteractionEvaluation" ADD CONSTRAINT "InteractionEvaluation_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE;

ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE;

ALTER TABLE "DecisionTrace" ADD CONSTRAINT "DecisionTrace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "TeacherOverride" ADD CONSTRAINT "TeacherOverride_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherOverride" ADD CONSTRAINT "TeacherOverride_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT;