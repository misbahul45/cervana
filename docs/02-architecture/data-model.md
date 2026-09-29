# Data Model Additions

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> New Prisma tables for learner state, memory, episodes, evaluation, optimization, and decision tracing. Existing entities are reused, not duplicated.

---

## 1. Purpose

Define the Prisma additions required by the target architecture. Existing tables (User, Topic, Lesson, Step, Quiz, QuizAttempt, Answer, LessonProgress, StepProgress, SubTopicProgress, UserTopic, UserStep, LearningStyleProfile, PersonalityQuiz, Chat, ChatMessage, Content, Resource) are **not redefined** here — they are reused.

Service ownership per `AGENTS.md` §Service Ownership: **all** new tables live in `api` (Postgres via Prisma). `ai-api` reads/writes via HTTP.

---

## 2. Prisma additions

### 2.1 Learner state

```prisma
model LearnerGoal {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  topicId       String
  topic         Topic       @relation(fields: [topicId], references: [id])
  targetMastery Float       @default(0.8)
  deadline      DateTime?
  status        GoalStatus  @default(ACTIVE)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@index([userId, status])
}

model TopicMasteryRecord {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  topicId          String
  topic            Topic     @relation(fields: [topicId], references: [id])
  score            Float     @default(0.0)
  confidence       Float     @default(0.0)
  evidenceCount    Int       @default(0)
  lastObservedAt   DateTime?
  lastDecayedAt    DateTime?
  @@unique([userId, topicId])
}

model StepMasteryRecord {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  stepId           String
  step             Step      @relation(fields: [stepId], references: [id])
  score            Float     @default(0.0)
  attempts         Int       @default(0)
  lastScore        Float?
  lastAttemptedAt  DateTime?
  hintUsedLast     Boolean   @default(false)
  @@unique([userId, stepId])
}

model Misconception {
  id            String               @id @default(uuid())
  userId        String
  user          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  conceptKey    String
  count         Int                  @default(1)
  firstSeenAt   DateTime             @default(now())
  lastSeenAt    DateTime             @default(now())
  status        MisconceptionStatus  @default(OPEN)
  @@unique([userId, conceptKey])
}

model LearningPreference {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  explanationStyle  String?
  problemStyle      String?
  pace              String?
  hintTolerance     String?
  lastUpdatedAt     DateTime @updatedAt
}

model BehavioralSignals {
  id                       String   @id @default(uuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  hintsPerQuestionAvg      Float?
  responseTimeAvgSec       Float?
  skipRate                 Float?
  retryRate                Float?
  lastUpdatedAt            DateTime @updatedAt
}
```

### 2.2 Memory

```prisma
model EpisodicMemory {
  id              String        @id @default(uuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventType       String
  content         String        @db.Text
  source          String
  lessonId        String?
  stepId          String?
  topicId         String?
  importance      Float         @default(0.5)
  evidenceCount   Int           @default(1)
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  status          MemoryStatus  @default(ACTIVE)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@index([userId, status])
  @@index([userId, topicId, status])
}

model SemanticLearnerMemory {
  id                String        @id @default(uuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  traitKey          String
  traitValue        String        @db.Text
  confidence        Float         @default(0.5)
  evidenceCount     Int           @default(1)
  sourceMemoryIds   Json
  status            MemoryStatus  @default(ACTIVE)
  lastUpdatedAt     DateTime      @updatedAt
  @@unique([userId, traitKey])
}

model ProceduralMemory {
  id                    String        @id @default(uuid())
  userId                String
  user                  User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  strategyKey           String
  conditions            Json
  expectedOutcome       String
  sampleSize            Int           @default(0)
  observedSuccessRate   Float?
  confidence            Float         @default(0.5)
  status                MemoryStatus  @default(ACTIVE)
  @@unique([userId, strategyKey])
}
```

### 2.3 Events and episodes

```prisma
model LearningEvent {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventType   String
  payload     Json
  createdAt   DateTime  @default(now())
  @@index([userId, eventType, createdAt])
}

model Episode {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  taskType        String
  inputPayload    Json
  retrievedChunks Json
  retrievedMemory Json
  strategy        Json
  promptVersion   String
  modelName       String
  response        String    @db.Text
  evaluationScore Float?
  evaluationJson  Json?
  inputTokens     Int?
  outputTokens    Int?
  costUsd         Decimal?  @db.Decimal(10, 6)
  latencyMs       Int?
  createdAt       DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([createdAt])
}

model InteractionEvaluation {
  id              String    @id @default(uuid())
  episodeId       String    @unique
  episode         Episode   @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  correctness     Float?
  grounding       Float?
  pedagogy        Float?
  personalization  Float?
  difficultyAlign Float?
  hallucination   Float?
  safety          Float?
  overallScore    Float?
  judgeModel      String
  judgeVersion    String
  createdAt       DateTime  @default(now())
}
```

### 2.4 Prompts, policies, experiments

```prisma
model PromptVersion {
  id              String         @id @default(uuid())
  name            String
  version         Int
  body            String         @db.Text
  modelName       String
  temperature     Float?
  status          PromptStatus   @default(DRAFT)
  createdAt       DateTime       @default(now())
  createdBy       String
  metricsJson     Json?
  parentVersionId String?
  @@unique([name, version])
  @@index([name, status])
}

model PolicyVersion {
  id              String         @id @default(uuid())
  name            String
  version         Int
  parametersJson  Json
  status          PromptStatus   @default(DRAFT)
  createdAt       DateTime       @default(now())
  createdBy       String
  metricsJson     Json?
  @@unique([name, version])
}

model Experiment {
  id            String           @id @default(uuid())
  name          String
  description   String?          @db.Text
  armsJson      Json
  status        ExperimentStatus @default(DRAFT)
  createdAt     DateTime         @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  createdBy     String
}

model ExperimentRun {
  id              String    @id @default(uuid())
  experimentId    String
  experiment      Experiment @relation(fields: [experimentId], references: [id])
  armName         String
  userId          String?
  metricsJson     Json
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
}

model EvaluationDataset {
  id              String    @id @default(uuid())
  name            String    @unique
  version         Int
  isFrozen        Boolean   @default(false)
  examplesJson    Json
  description     String?   @db.Text
  createdAt       DateTime  @default(now())
  @@unique([name, version])
}

model OptimizationRun {
  id                  String                 @id @default(uuid())
  optimizerName       String
  basePromptVersionId String?
  candidateJson       Json
  baseMetricsJson     Json
  candidateMetricsJson Json
  decision            OptimizationDecision
  rationale           String?                @db.Text
  decidedBy           String?
  decidedAt           DateTime?
  createdAt           DateTime               @default(now())
}
```

### 2.5 Decision trace

```prisma
model DecisionTrace {
  id              String    @id @default(uuid())
  traceId         String    @unique
  userId          String
  sessionId       String?
  taskId          String?
  agentVersion    String
  promptVersion   String
  policyVersion   String
  modelName       String
  strategyJson    Json
  retrievedMemory Json
  retrievedChunks Json
  responseText    String    @db.Text
  evaluationJson  Json?
  latencyMs       Int?
  inputTokens     Int?
  outputTokens    Int?
  costUsd         Decimal?  @db.Decimal(10, 6)
  createdAt       DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([traceId])
}
```

### 2.6 Human override

```prisma
model TeacherOverride {
  id              String    @id @default(uuid())
  teacherId       String
  teacher         User      @relation(fields: [teacherId], references: [id])
  targetUserId    String
  targetUser      User      @relation(fields: [targetUserId], references: [id])
  targetType      String
  targetId        String
  beforeValue     Json
  afterValue      Json
  reason          String    @db.Text
  createdAt       DateTime  @default(now())
}
```

---

## 3. Enums

```prisma
enum GoalStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}

enum MisconceptionStatus {
  OPEN
  RESOLVED
}

enum MemoryStatus {
  ACTIVE
  DECAYING
  SUPERSEDED
  INVALIDATED
  ARCHIVED
}

enum PromptStatus {
  DRAFT
  EXPERIMENTAL
  VALIDATED
  ACTIVE
  REJECTED
  ROLLED_BACK
  ARCHIVED
}

enum ExperimentStatus {
  DRAFT
  RUNNING
  COMPLETED
  CANCELLED
}

enum OptimizationDecision {
  PENDING
  ACCEPTED
  REJECTED
  DEFERRED
}
```

---

## 4. Prerequisite graph

Add `Step.prerequisiteSteps: Step[]` — a self-referential many-to-many on `Step`. Cycle detection at write time.

```prisma
// Add to Step model
prerequisiteSteps Step[] @relation("Prerequisites")
prerequisiteOf    Step[] @relation("Prerequisites")
```

Cycle detection at insert time prevents invalid graphs (e.g., A → B → A).

---

## 5. Why this shape

| Decision | Reason |
|---|---|
| Typed memory in Postgres, not pure Qdrant | Transactional consistency; can JOIN with other tables; SQL-level tenant isolation. |
| `Episode` as first-class object | Required for self-improvement (loop B / C). |
| `DecisionTrace` separate from `Episode` | Trace captures routing and policy version; episode captures content and evaluation. |
| `OptimizationRun.decision: OptimizationDecision` | Type-safe enum; never `string`. |
| `TeacherOverride` records `before`/`after` JSON | Auditability of human edits. |

---

## 6. Migration order

1. Apply migration in dev environment. Verify schema applies cleanly.
2. Backfill `TopicMasteryRecord` initial scores from existing `StepProgress.progress`.
3. Mark existing Qdrant `cervana-memory` rows as `SUPERSEDED` (no automatic delete).
4. Apply to staging. Run 24h soak. Verify no errors.
5. Apply to production.

Backfill query (sketch):

```sql
INSERT INTO "TopicMasteryRecord" (id, "userId", "topicId", score, confidence, "evidenceCount", "lastObservedAt")
SELECT
  gen_random_uuid(),
  sp."userId",
  t.id,
  AVG(sp.progress) / 100.0,
  0.3,                                                 -- low confidence for backfilled data
  COUNT(sp.id),
  MAX(sp."updatedAt")
FROM "StepProgress" sp
JOIN "Step" s ON s.id = sp."stepId"
JOIN "SubTopic" st ON st.id = s."subTopicId"
JOIN "Topic" t ON t.id = st."topicId"
GROUP BY sp."userId", t.id
ON CONFLICT ("userId", "topicId") DO NOTHING;
```

---

## 7. Trade-offs

| Choice | Alternative considered | Why this |
|---|---|---|
| 4 memory tables (working / episodic / semantic / procedural) | 1 mixed memory table | Separation of concerns per master prompt §10. |
| Separate `Episode` and `DecisionTrace` | One combined `Interaction` table | Episode = content + evaluation; DecisionTrace = routing + policy version. Different audit consumers. |
| `OptimizationRun` as immutable record | Mutable "current best prompt" pointer | Immutable history enables A/B rollbacks. |
| `EvaluationDataset` table | File-based JSONL | DB-integrity: enforce `isFrozen` flag at row level. |
| `Decimal(10,6)` for cost | `Float` | Float rounding errors break financial reconciliation. |