# Concurrency and Consistency

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Where ReduCera has race conditions, what consistency guarantees are required, and how to enforce them.

---

## 1. Scope

Concurrency in a two-service system has three layers:

1. **Within a single Postgres row**: handled by Prisma's single-row atomicity.
2. **Across multiple Postgres rows in one transaction**: handled by Prisma's `$transaction` (interactive or sequential).
3. **Across services (api ↔ ai-api)**: requires explicit design.

This audit inventories every place where:

- Two requests could race on the same row.
- Multi-row consistency is required but not enforced.
- Cross-service ordering could be lost.

---

## 2. Race conditions found

### 2.1 Streak increment

[`streaks.repo.ts:136-171`](../../services/api/src/v1/gamify/streaks/streaks.repo.ts)

```typescript
async incrementOrReset(userId, activityType) {
    const existingToday = await this.findToday(userId, start, end);
    if (existingToday) return existingToday;
    const last = await this.findLast(userId, activityType);
    let streakCount = 1;
    if (last) { /* compute streak */ }
    return await this.create({ userId, date: today, activityType, streakCount });
}
```

**Race**: two concurrent requests both observe `existingToday === null`; both compute `streakCount`; both insert. Result: two `StreakHistory` rows for the same day.

The `@@unique([userId, date])` constraint prevents duplicate inserts only if Prisma respects it (it does). The second insert raises `P2002`. The current code does **not** catch it; the exception bubbles.

**Fix**: wrap in `try { insert } catch (P2002) { findToday }`. Or use `upsert` semantics:

```typescript
await prisma.streakHistory.upsert({
    where: { userId_date: { userId, date: today } },
    update: {},
    create: { userId, date: today, activityType, streakCount },
});
```

### 2.2 Daily activity log

[`daily-activity.interceptor.ts:13-49`](../../services/api/src/common/interceptors/daily-activity.interceptor.ts)

```typescript
const existingLog = await this.dailyLogRepo.findToday(userId, start, end);
if (!existingLog) {
    await this.dailyLogRepo.create({ userId, date: today, activityType: DAILY_LOGIN });
    await this.streaksRepo.incrementOrReset(userId, DAILY_LOGIN);
}
```

**Race**: same pattern. Two concurrent pings both observe `existingLog === null`, both create, both increment.

The `@@index([userId, date])` is **not** a unique constraint. Both inserts succeed.

**Fix**: same as §2.1 — use `upsert` for `DailyActivityLog`. Plus add `@@unique([userId, date])` to `DailyActivityLog` so duplicates are rejected at the DB level.

### 2.3 Leaderboard score

[`leaderboards.repo.ts:151-174`](../../services/api/src/v1/gamify/leaderboards/leaderboards.repo.ts)

```typescript
async incrementScore(userId, leaderboardType, incrementBy) {
    const leaderboardScore = await this.prisma.leaderboardScore.findFirst({...});
    let result;
    if (leaderboardScore) {
        result = await this.prisma.leaderboardScore.update({
            where: { id: leaderboardScore.id },
            data: { score: { increment: incrementBy } },
        });
    } else {
        result = await this.prisma.leaderboardScore.create({...});
    }
    this.emitter.leaderboardUpdated(result);
    return result;
}
```

**Race**: two concurrent calls can both observe `findFirst === null` and both create. Two rows for the same `(userId, scope, ...)` violate the `@@unique` constraint.

`@@unique([userId, scope, categoryId, topicId, subTopicId])` (from migration [`20251202230940_final_db/migration.sql`](../../services/api/prisma/migrations/20251202230940_final_db/migration.sql)) prevents one duplicate; but if two requests race past `findFirst`, both attempt to create, the second raises `P2002`.

**Fix**: same upsert pattern.

### 2.4 Personality quiz double-submit

[`personality-quizzes.service.ts:168`](../../services/api/src/v1/learning/personality-quizzes/personality-quizzes.service.ts)

After `submitAttempt` succeeds, the service enqueues `addUserStepsJob`. If the user double-clicks Submit, two POSTs to `/submit/:id` both succeed and both enqueue. The Celery worker generates user-steps twice.

**Fix**: idempotency key on the submit endpoint (see [`microservice-boundary-audit.md` §8](./microservice-boundary-audit.md#8-service-contract-audit)).

### 2.5 Chat message ordering

`POST /chat/chat-messages` accepts a message; `PATCH /chat/chat-messages/:id` updates status. If the AI service is slow, the user may send multiple messages in flight. Each is a separate insert; order is determined by `createdAt` timestamp. No race, but client may display out-of-order if clocks drift.

**Fix**: server-assigned monotonic sequence per chat (`ChatMessage.sequence INT`). Clients sort by `sequence`, not timestamp.

### 2.6 Mastery update (future)

When the learner model is implemented, two simultaneous quiz submissions could both read the same `mastery.score`, compute the same delta, and both write back. The second write wins; one delta is lost.

**Fix**: optimistic locking via version number:

```prisma
model TopicMasteryRecord {
    ...
    version Int @default(0)
}
```

```typescript
const result = await prisma.topicMasteryRecord.updateMany({
    where: { userId, topicId, version: expectedVersion },
    data: { score: newScore, version: { increment: 1 } },
});
if (result.count === 0) throw new ConflictError();
```

The 409 triggers a re-read and re-compute.

### 2.7 Memory writes (future)

Two simultaneous memory writes for the same `learner_id + trait_key` could race. Mitigation: `@@unique([userId, traitKey])` on `SemanticLearnerMemory` plus upsert.

Two episodic memory writes for the same event (Celery retry of `tool_memory_upsert`) would create duplicates. Mitigation: caller generates a deterministic `event_id` (e.g., `episodeId`); dedup at the API layer.

---

## 3. Consistency guarantees required

| Data | Consistency | Mechanism |
|---|---|---|
| `User` row updates | strong | Prisma atomic single-row |
| `Order` + `payment` row | strong | Stripe webhook idempotency + DB constraint |
| `QuizAttempt.score`, `Answer.isCorrect` | strong | Single transaction in `submitAttempt` |
| `StreakHistory` row | strong (unique per user-day) | `@@unique([userId, date])` + upsert |
| `TopicMasteryRecord` | strong | Optimistic locking via `version` |
| `EpisodicMemory` (write) | strong (idempotent) | Idempotency key on `POST /memory/upsert` |
| `EpisodicMemory` (read) | eventual | TTL-based garbage collection |
| `SemanticLearnerMemory` (write) | strong (unique per trait) | `@@unique([userId, traitKey])` + upsert |
| `DecisionTrace` | strong (append-only) | `@@unique([traceId])` + insert-only |
| `OptimizationRun` | strong (immutable) | No UPDATE permission; only INSERT |
| `Episode` (write) | strong (idempotent) | Idempotency key on `POST /episodes` |

---

## 4. Cross-service ordering

The AI service writes to the Application API via HTTP. Ordering problems:

### 4.1 Order: PATCH chat-message then POST content

`v1/learning/workers.py:79-87`:

```python
update_message_chat(message_id, token, {"text": "Successfully generate...", "status": "COMPLETED"})
create_content_material({...}, token)
```

If the second call fails (network error), the message status says `COMPLETED` but no content exists. The user sees a status mismatch.

**Fix**: write content first; on success, update message status. If content write fails, the message stays in `PROCESSING` and can be retried.

### 4.2 Order: queue user-steps then run generation

[`knowledge.processor.ts`](../../services/api/src/v1/queue/queues/knowledge.processor.ts) calls `ai-api /resources/extract` then `ai-api /resources/embedding`. If extract succeeds but embedding fails (e.g., Qdrant down), the Celery task retries; but `ai-api` has already extracted once and is idempotent only via `extract_task` (3× backoff). The api side has no idempotency.

**Fix**: each AI service endpoint must accept an `Idempotency-Key`. The Application API stores `(key, response)` for 24h.

---

## 5. Locking strategy

For per-row updates that require read-then-write (mastery, memory):

| Strategy | When to use |
|---|---|
| Single atomic SQL | `UPDATE ... WHERE version = $v` |
| Postgres advisory lock | Cross-table consistency (rarely needed) |
| Optimistic locking with `version` column | Default for derived state |
| Pessimistic (`SELECT ... FOR UPDATE`) | Last resort; serializes transactions |

Advisory locks are not currently used. They should be reserved for cases where optimistic locking would cause too many retries (e.g., hot streak counters under load).

---

## 6. Cross-reference

- API contracts: [`microservice-boundary-audit.md`](./microservice-boundary-audit.md) §8
- Data model additions: [`data-model.md`](../02-architecture/data-model.md) §2
- Test requirements: [`test-matrix.md`](./test-matrix.md) §2.12