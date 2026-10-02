# Phase 9 — Production Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden ReduCera for real-world load. Performance (caching, queue, background jobs), security (RBAC audit, encryption-at-rest considerations, audit logging), reliability (backup, monitoring, runbook, basic DR).

**Architecture:** Reuse the existing `AuditLog` model. Add `RateLimit` table for per-user counters. Add `BackupRecord` for backup-record-state jobs. Add Nginx `limit_req` zone. Add per-user rate limiting on `ai-api /ai/v1/chat`. Add nightly backup script + monthly restore drill. Add monitoring stack (Prometheus + Grafana via Docker Compose). Document runbook for DB restore, Redis flush recovery, Qdrant rebuild.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ (existing), Nginx 1.27, Prometheus, Grafana, pnpm.

## Global Constraints

Same as Phases 0-8. Plus:

- Per-user rate limit on `ai-api /ai/v1/chat` (per spec §5.10).
- Nginx `limit_req` returns 429 on synthetic burst test.
- Nightly backup produces a verifiable Postgres dump.
- Load test (`k6`) shows p95 < 500ms on `GET /chat/contents/similarity` with 100 VUs.
- Critical alerts only: 5xx rate, payment failure rate, queue depth, Redis memory (per spec §5.10).
- Backups tested via monthly restore drill.

---

## Task 1: Audit current state of production hardening

**Files:**
- Read: `infra/nginx/nginx.conf` (look for `limit_req`)
- Read: `services/api/src/v1/queue/queues/`, `services/api/src/v1/queue/schedules/`
- Read: `docs/operations/` (existing runbook, runbooks)
- Create: `docs/progress-tracker.md` (append Phase 9 audit table)

- [ ] **Step 1: Verify no Nginx `limit_req`**

Run:
```
grep -n "limit_req\|limit_req_zone" infra/nginx/nginx.conf
```
Expected: no matches.

- [ ] **Step 2: Verify no RateLimit table**

Run:
```
grep -nE "model RateLimit|model BackupRecord" services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 3: Verify no runbook for DB restore**

Run:
```
ls docs/operations/runbook 2>/dev/null
ls infra/scripts/restore-drill.sh 2>/dev/null
ls infra/scripts/backup.sh 2>/dev/null
```
Expected: at most partial scaffolding; Phase 9 may need to add.

- [ ] **Step 4: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 9 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| Nginx limit_req | MISSING | grep |
| RateLimit / BackupRecord models | MISSING | grep |
| Runbook docs/operations/runbook | MISSING | ls |
| backup.sh | MISSING | ls |
| restore-drill.sh | MISSING | ls |
| Monitoring stack (Prometheus + Grafana) | MISSING | docker-compose grep |
```

---

## Task 2: Add RateLimit + BackupRecord Prisma models

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_production/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/production-invariants.int.spec.ts`

- [ ] **Step 1: Add the models**

Append to `services/api/prisma/schema.prisma`:

```prisma
model RateLimit {
  id        String   @id @default(uuid())
  userId    String
  scope     String
  windowStart DateTime
  count     Int      @default(0)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, scope, windowStart])
  @@index([scope, windowStart])
}

model BackupRecord {
  id          String   @id @default(uuid())
  tag         String   @unique
  sizeBytes   BigInt
  checksum    String
  storageUri  String
  status      BackupStatus @default(PENDING)
  startedAt   DateTime @default(now())
  completedAt DateTime?
  restoredAt  DateTime?

  @@index([status, startedAt])
}

enum BackupStatus {
  PENDING
  COMPLETED
  FAILED
  RESTORED
}
```

- [ ] **Step 2: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save to `services/api/prisma/migrations/<timestamp>_production/migration.sql`.

- [ ] **Step 3: Apply on a scratch DB**

Run: `TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy`

- [ ] **Step 4: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/production-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Production invariants (Phase 9)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('RateLimit unique (userId, scope, windowStart)', async () => {
    const user = await prisma.user.create({ data: { email: 'rl@test', role: 'STUDENT' as any } });
    const w = new Date();
    await prisma.rateLimit.create({ data: { userId: user.id, scope: 'chat', windowStart: w, count: 1 } });
    await expect(prisma.rateLimit.create({ data: { userId: user.id, scope: 'chat', windowStart: w, count: 2 } })).rejects.toThrow();
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('BackupRecord tag is unique', async () => {
    await prisma.backupRecord.create({ data: { tag: 'b1', sizeBytes: 100, checksum: 'sha1', storageUri: 'file://x' } });
    await expect(prisma.backupRecord.create({ data: { tag: 'b1', sizeBytes: 100, checksum: 'sha2', storageUri: 'file://y' } })).rejects.toThrow();
    await prisma.backupRecord.deleteMany({ where: { tag: 'b1' } });
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/production-invariants.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 3: Implement `RateLimitService`

`create` `services/api/src/v1/common/rate-limit/rate-limit.service.ts` + middleware.

Tasks:
1. Service: `consume(scope, userId)` checks + increments `RateLimit` row for current minute; throws 429 if exceeded
2. Add `RateLimitGuard` (NestJS) for per-route application
3. Test: 5 requests in 1 minute, 6th returns 429

---

## Task 4: Add Nginx `limit_req` zone

`modify` `infra/nginx/nginx.conf`:

```
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $http_authorization zone=api_user:10m rate=2r/s;

server {
  location /api/ {
    limit_req zone=api burst=20 nodelay;
    limit_req zone=api_user burst=5 nodelay;
    ...
  }
}
```

(Per-IP 10/sec with burst 20; per-token 2/sec with burst 5.)

Test: 30 requests in 1 second → at least 5 return 429.

---

## Task 5: Add rate limit on `ai-api /ai/v1/chat`

Per-user rate limit on the chat endpoint. Reuse `RateLimitService` over HTTP (`api /v1/common/rate-limit/check`).

Test: 6 requests in 1 minute, 7th returns 429.

---

## Task 6: Backup script + restore drill

`create` `infra/scripts/backup.sh` (nightly cron) and `infra/scripts/restore-drill.sh` (monthly).

Tasks:
- `backup.sh` runs `pg_dump`, computes `sha256`, writes `BackupRecord` row with `storageUri = file:///backups/<tag>.dump.gz`
- `restore-drill.sh` creates a temporary Postgres, restores the latest dump, runs `pnpm jest` smoke test
- Schedule via existing cron system or BullMQ job

Test: run `backup.sh`; verify `BackupRecord` row exists with `status: COMPLETED`. Restore drill: full smoke pass.

---

## Task 7: Monitoring stack

`modify` `docker-compose.yml` to add `prometheus` + `grafana` services. Add `infra/prometheus/prometheus.yml` and `infra/grafana/dashboards/`.

Tasks:
- prometheus.yml scrapes `api:3002/metrics`, `ai-api:3003/metrics`, `nginx-exporter:9113`
- Grafana dashboard: 5xx rate, payment failure rate, queue depth, Redis memory, p95 chat latency
- Critical alerts only (5xx > 1%, payment > 0.5%, queue > 1000, Redis > 80%)

---

## Task 8: Runbook

`create` `docs/operations/runbook/` with:
- `db-restore.md`: how to restore from a Postgres dump
- `redis-flush-recovery.md`: how to recover from a Redis flush (cache miss storm)
- `qdrant-rebuild.md`: how to rebuild the Qdrant collection from `content_embeddings`

Each runbook: preconditions, exact commands, expected output, what to verify before declaring recovery complete.

---

## Task 9: Load test with k6

`create` `infra/scripts/k6/chat-similarity.js`:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '2m',
  thresholds: {
    'http_req_duration{name:similarity}': ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('http://api:3002/v1/chat/contents/similarity?chatId=c1&query=double-entry', {
    headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN}` },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

Run via `docker run --rm -i grafana/k6 run - <infra/scripts/k6/chat-similarity.js` (or the existing `perf_run_k6` tool from Xninetzy).

Acceptance: p95 < 500ms with 100 VUs for 2 minutes.

---

## Task 10: Phase 9 acceptance gates

Verify:
- nginx `limit_req` returns 429 on synthetic burst
- Nightly backup produces a verifiable Postgres dump
- Per-user rate limit on `ai-api /ai/v1/chat` enforced
- k6 p95 < 500ms
- Runbook covers DB restore, Redis flush, Qdrant rebuild

Append the verification table to `docs/progress-tracker.md`.

---

## Final Completion Check

The 10-phase plan is complete when:

| ID | Criterion | Evidence |
|---|---|---|
| SC-1 | All 10 phases have `DONE` status | `docs/progress-tracker.md` |
| SC-2 | Sandbox route reachable from a fresh seed | curl |
| SC-3 | Circular economy loop testable end-to-end | integration test |
| SC-4 | AI agents all behind decision-trace table | psql |
| SC-5 | Cumulative test count >= 460 green | CI |
| SC-6 | Playwright MCP matrix green on apps touched | `.playwright-mcp/` |
| SC-7 | AGENTS.md detection grep gate is in CI | `.github/workflows/ci.yml` |
| SC-8 | Backup + restore drill executed within last 30 days | log |
| SC-9 | No `--no-verify`, no `--force`, no agent commits | `git log` |
| SC-10 | Per-phase report exists for all 10 phases | `docs/progress-tracker.md` |

When all 10 are met, the 10-phase plan itself is `DONE`. Owner performs final stage + commit.

---

## Out of Scope for Phase 9 (deferred)

- Multi-region deployment, advanced WAF, full DR: V3
- Per-tenant rate limits: V2
- Real-time cost analytics: V2