# Track R Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adapted for this repo:** "Commit" steps in the standard template are replaced by "Report" steps. The agent never runs `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, or `git stash drop`. Staging and committing are owner responsibilities.

**Goal:** Execute the five Track R tasks of the V1 execution plan to a verifiable state: CORS via environment, no local-model plumbing in compose/Dockerfile, dev database baselined, full stack brought up or blocker named, owner-run cleanup instructions printed.

**Architecture:** Five sequential tasks (R-02, R-06, R-04, R-03, R-05). R-02 and R-06 are reversible file changes. R-04 is migration state management. R-03 is a bring-up verification that may end `BLOCKED` without owner-provided secrets. R-05 is documentation-only.

**Tech Stack:** NestJS 11, Prisma 7, Docker Compose v2, OpenAI-compatible LLM (Flaz), Hugging Face Inference (remote embeddings), Jest, Playwright MCP, codebase-memory-mcp.

## Global Constraints

These constraints apply to every task. Sources: `AGENTS.md` and the V1 execution plan §2.

- **No comments in code, Dockerfiles, compose, nginx, or config files.** Variable names and function names carry the documentation.
- **Never run `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, or `git stash`.** Stage and commit are owner responsibilities.
- **No secrets in tracked files, docs, or logs.** Never print values from `.env`.
- **Never run `prisma format`.** It rewrites the whole schema file and was reverted once in Phase 1.
- **Never edit an applied migration.** Write new migrations by hand using `prisma migrate diff`.
- **Test only on a scratch database, never the dev one.** R-04 is the documented exception (rehearsed on `reducera_phase1_legacy` per Phase 1).
- **For every zero-caller or "does not exist" claim**, run `codebase-memory-mcp`: `index_status`, `check_index_coverage`, `search_graph`, `trace_path` (direction `inbound`), `get_code_snippet`, plus `grep` confirmation.
- **For any change that affects what the web renders**, run the Playwright MCP matrix at viewports 375x812, 768x1024, 1280x800, light and dark colour schemes, and `reducedMotion: reduce` once. Screenshots → `.playwright-mcp/<name>.png` (the folder is gitignored). R-03 includes this matrix.
- **Code, identifiers and docs in English.** User-facing web copy in Indonesian (n/a for Track R).
- **Status values:** `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never `DONE` for work not run.
- **Keep each task's diff reviewable.** If a task grows past ~400 changed lines, split it.

---

## File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/api/src/common/lib/origins.ts` | Create in Task 1 | Pure helper: parse comma-separated origin list |
| `services/api/src/common/lib/origins.spec.ts` | Create in Task 1 | Unit tests for the helper |
| `services/api/src/main.ts` | Modify in Task 1 | Read `CORS_EXTRA_ORIGINS` from env, drop hard-coded `cervana.vercel.app` literal |
| `.env.example` | Modify in Task 1 | Declare `CORS_EXTRA_ORIGINS` |
| `docker-compose.yml` | Modify in Task 1 and Task 2 | Add env pass-through (Task 1); remove `hf_cache` volume and local-model env vars (Task 2) |
| `docker-compose.prod.yml` | Modify in Task 1 and Task 2 | Same as dev compose |
| `services/ai-api/Dockerfile` | Modify in Task 2 | Remove `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT` |
| (no file changes in Tasks 3, 4, 5) | — | Tasks 3–5 are operations or migrations only |

No new files in Task 3 (migration state management), Task 4 (bring-up), or Task 5 (print instructions).

---

### Task 1: R-02 CORS env migration

**Files:**
- Create: `services/api/src/common/lib/origins.ts`
- Create: `services/api/src/common/lib/origins.spec.ts`
- Modify: `services/api/src/main.ts:28-34`
- Modify: `.env.example`
- Modify: `docker-compose.yml` (api service environment)
- Modify: `docker-compose.prod.yml` (api service environment)

**Interfaces:**
- Consumes: `process.env.CORS_EXTRA_ORIGINS` (raw env string, undefined or comma-separated)
- Produces: `parseOrigins(raw: string | undefined): string[]` exported from `services/api/src/common/lib/origins.ts`

- [ ] **Step 1.1: Write the failing test for `parseOrigins`**

Create `services/api/src/common/lib/origins.spec.ts`:

```typescript
import { parseOrigins } from './origins';

describe('parseOrigins', () => {
  it('returns empty array for undefined', () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseOrigins('')).toEqual([]);
  });

  it('parses a single origin', () => {
    expect(parseOrigins('https://a.example')).toEqual(['https://a.example']);
  });

  it('parses multiple comma-separated origins', () => {
    expect(parseOrigins('https://a.example,https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseOrigins('  https://a.example ,  , https://b.example  ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('preserves case of scheme and host', () => {
    expect(parseOrigins('HTTPS://A.Example')).toEqual(['HTTPS://A.Example']);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/common/lib/origins.spec.ts`
Expected: FAIL with "Cannot find module './origins'" or equivalent.

- [ ] **Step 1.3: Implement `parseOrigins`**

Create `services/api/src/common/lib/origins.ts`:

```typescript
export function parseOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `cd services/api && pnpm jest src/common/lib/origins.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 1.5: Audit call sites for `cervana.vercel.app` in `services/api/src`**

Run via `codebase-memory-mcp`:
1. `list_projects` → confirm `home-misbahul45-code-reducera`.
2. `check_index_coverage` with `paths: ["services/api/src/main.ts"]`.
3. `search_graph` with `name_pattern: "cors|CORS|origins"` (best-effort).
4. `grep -rn "cervana.vercel.app" services/api/src --include="*.ts"` to confirm all hits.

Expected: only `services/api/src/main.ts` (the one line we are about to remove). If other files reference it, list them and stop — owner decision required.

- [ ] **Step 1.6: Modify `main.ts` to read env and remove the hard-coded literal**

Open `services/api/src/main.ts`. Locate lines 28-34 (the `app.enableCors({ origin: [...] })` block).

Replace the origin array so that:
- The dev defaults remain (`http://localhost:3000`, `http://localhost:3001`).
- `CORS_EXTRA_ORIGINS` from env is parsed by `parseOrigins` and appended.
- The hard-coded `https://cervana.vercel.app` literal disappears.

Final form should look like:

```typescript
import { parseOrigins } from './common/lib/origins';

const devOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const extraOrigins = parseOrigins(process.env.CORS_EXTRA_ORIGINS);
const allowedOrigins = Array.from(new Set([...devOrigins, ...extraOrigins]));

app.enableCors({
  origin: allowedOrigins,
  credentials: true,
});
```

(Adjust the property names to match what `main.ts` already uses; do not introduce new ones.)

- [ ] **Step 1.7: Update `.env.example`**

Open `.env.example`. Add a line declaring `CORS_EXTRA_ORIGINS` next to the other `CORS_*` lines if any, or in the security-related block. Use a blank value so the default still works for local dev:

```
CORS_EXTRA_ORIGINS=
```

Do not add a comment. The variable name is the documentation.

- [ ] **Step 1.8: Update both compose files**

In `docker-compose.yml` and `docker-compose.prod.yml`, locate the `api` service `environment` block. Append `CORS_EXTRA_ORIGINS=${CORS_EXTRA_ORIGINS:-}` so the variable flows from host `.env` into the container.

- [ ] **Step 1.9: Run the verification matrix**

| Check | Command | Expected |
|---|---|---|
| Helper tests | `cd services/api && pnpm jest src/common/lib/origins.spec.ts` | exit 0 |
| Full Jest suite | `cd services/api && pnpm jest --silent` | exit 0; no regressions |
| Compose dev | `docker compose config -q` | exit 0 |
| Compose prod | `docker compose -f docker-compose.prod.yml config -q` | exit 0 |
| Hard-coded origin | `grep -rn "cervana.vercel.app" services/api/src --include="*.ts"` | empty |

- [ ] **Step 1.10: Report changed files**

Print a list of changed files to stdout:

```
Changed files (R-02):
- services/api/src/common/lib/origins.ts (created)
- services/api/src/common/lib/origins.spec.ts (created)
- services/api/src/main.ts (modified)
- .env.example (modified)
- docker-compose.yml (modified)
- docker-compose.prod.yml (modified)
```

The owner will stage and commit.

---

### Task 2: R-06 Remove local-model plumbing

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `services/ai-api/Dockerfile` (lines around 47-53)

**Interfaces:**
- Consumes: nothing new
- Produces: `HF_TOKEN` retained in `ai-api` and `celery-worker` environments; `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT` removed from compose and Dockerfile; `hf_cache` volume removed.

- [ ] **Step 2.1: Pre-check: no Python code uses local-model libraries**

Run: `grep -rn "huggingface_hub\|transformers\|sentence_transformers" services/ai-api --include="*.py"`

Expected: empty. If non-empty, stop and report to the owner.

- [ ] **Step 2.2: Audit `hf_cache` volume via graph and grep**

Run via `codebase-memory-mcp`:
1. `search_graph` with `query: "hf_cache"` (best-effort).
2. `search_code` with `pattern: "hf_cache"` in path filter `^docker-compose.*yml$`.
3. Confirm `hf_cache` is declared only in `docker-compose.yml` and `docker-compose.prod.yml` (not referenced elsewhere).

- [ ] **Step 2.3: Remove `hf_cache` volume from both compose files**

Open `docker-compose.yml` and `docker-compose.prod.yml`. Find the `volumes:` top-level declaration. Remove the `hf_cache:` entry and its driver config.

- [ ] **Step 2.4: Remove `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT` from both compose files**

Open `docker-compose.yml` and `docker-compose.prod.yml`. In the `ai-api` service `environment` block, remove the four env vars. If `celery-worker` has them too, remove there as well. Keep `HF_TOKEN`.

- [ ] **Step 2.5: Remove the same env vars from `services/ai-api/Dockerfile`**

Open `services/ai-api/Dockerfile`. Around lines 47-53, remove the `ENV HF_HOME=...`, `ENV HF_HUB_ENABLE_HF_TRANSFER=...`, `ENV HF_ENDPOINT=...`, `ENV HF_HUB_HTTP_TIMEOUT=...` lines. Also remove any `RUN mkdir -p $HF_HOME` or `RUN hf cache ...` lines if present. Keep `HF_TOKEN` if it is referenced.

- [ ] **Step 2.6: Run the verification matrix**

| Check | Command | Expected |
|---|---|---|
| Pre-check empty | `grep -rn "huggingface_hub\|transformers\|sentence_transformers" services/ai-api --include="*.py"` | empty |
| Compose dev | `docker compose config -q` | exit 0 |
| Compose prod | `docker compose -f docker-compose.prod.yml config -q` | exit 0 |
| Image builds | `docker compose build ai-api` | exit 0 |
| No leftover env | `grep -rn "HF_HOME\|HF_HUB_ENABLE_HF_TRANSFER\|HF_ENDPOINT\|HF_HUB_HTTP_TIMEOUT" docker-compose.yml docker-compose.prod.yml services/ai-api/Dockerfile` | empty |

- [ ] **Step 2.7: Report changed files**

```
Changed files (R-06):
- docker-compose.yml (modified)
- docker-compose.prod.yml (modified)
- services/ai-api/Dockerfile (modified)
```

---

### Task 3: R-04 Baseline dev database `reducera`

**Files:**
- No code or migration file changes. State management only.

**Interfaces:**
- Consumes: a running `postgres` container; `DATABASE_URL` from gitignored `.env`.
- Produces: dev database `reducera` with all 11+ migrations applied and `_prisma_migrations` table populated.

- [ ] **Step 3.1: Pre-check: Postgres is running and `reducera` exists**

Run: `docker compose ps postgres` — expected `healthy`. If not, halt. The agent does not start Postgres as part of Track R.

Run: `psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"`. Expected: 58. If not 58, stop and report to the owner.

Run: `psql "$DATABASE_URL" -c "SELECT to_regclass('_prisma_migrations')"`. Expected: NULL (the migrations table does not exist yet). If the table exists, stop — the database is not in the expected baseline state.

- [ ] **Step 3.2: Backup recommendation (printed, not executed)**

Print to stdout:

```
[Owner action] Before R-04 runs, please back up the `reducera` database:
  pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f reducera-pre-r04.dump
```

Do not run the backup. Wait for owner confirmation.

If the owner does not confirm a backup, halt the task and ask before proceeding.

- [ ] **Step 3.3: Resolve the five pre-Phase-1 migrations as applied**

For each migration in order:
- `20251202032210_final_db`
- `20251202230940_final_db`
- `20260115090000_idempotency_key`
- `20260115100000_domain_model`
- `20260115110000_content_job_fields`

Run:

```
cd services/api
npx prisma migrate resolve --applied 20251202032210_final_db
npx prisma migrate resolve --applied 20251202230940_final_db
npx prisma migrate resolve --applied 20260115090000_idempotency_key
npx prisma migrate resolve --applied 20260115100000_domain_model
npx prisma migrate resolve --applied 20260115110000_content_job_fields
```

Expected: each command exits 0.

- [ ] **Step 3.4: Apply remaining migrations**

Run: `cd services/api && npx prisma migrate deploy`

Expected: exit 0; remaining migrations (including the Phase 1 and Phase 3 ones) deploy.

If any migration fails, run `npx prisma migrate resolve --rolled-back <failing_migration>` per failing migration, stop, and report.

- [ ] **Step 3.5: Run the verification matrix**

| Check | Command | Expected |
|---|---|---|
| Status up to date | `cd services/api && npx prisma migrate status` | "Database schema is up to date" |
| No drift | `cd services/api && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | empty output |
| Migrations table exists | `psql "$DATABASE_URL" -c "SELECT count(*) FROM _prisma_migrations"` | ≥ 11 |

- [ ] **Step 3.6: Report status and changed files**

```
Task 3 (R-04) status: DONE
Database state: baselined at <commit short SHA of schema>, 11+ migrations applied
No file changes ( committed
```

---

### Task 4: R-03 Bring up full stack

**Files:**
- No file changes.

**Interfaces:**
- Consumes: complete `.env` at repo root with `INTERNAL_AI_API_SECRET`, `MANUAL_PAYMENT_ACCOUNTS`, `OPENAI_API_KEY` set.
- Produces: all services healthy; web returns zero console errors at `/`.

- [ ] **Step 4.1: Pre-check: required secrets present**

For each variable, run `test -n "$VAR" && echo set || echo missing`:

- `INTERNAL_AI_API_SECRET`
- `MANUAL_PAYMENT_ACCOUNTS`
- `OPENAI_API_KEY`

If any are `missing`:
- mark task `BLOCKED
- print:

```
[R-03 BLOCKED] The following variables are missing in .env:
- <list of missing variable names>

Please set them (values are not requested; never paste values into this report):
  INTERNAL_AI_API_SECRET    (openssl rand -base64 48)
  MANUAL_PAYMENT_ACCOUNTS   (JSON object with real bank info)
  OPENAI_API_KEY            (Flaz gateway key)

Then re-run Task 4 from Step 4.1.
```

Do not proceed with the bring-up. Stop the task here.

- [ ] **Step 4.2: Bring up the full stack**

Run: `docker compose up -d --build`

Expected: exit 0. The command is idempotent.

- [ ] **Step 4.3: Wait for all services to be healthy (poll up to 120 s)**

Run in a loop with 5 s interval:

```
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24; do
  if docker compose ps --format json | jq -r '.[] | select(.Health != "healthy") | .Name' | grep -q .; then
    sleep 5
  else
    break
  fi
done
docker compose ps
```

Expected: all services `healthy` or starting without errors. If after 120 s some service is `unhealthy`, run `docker compose logs <service>` and stop.

- [ ] **Step 4.4: Smoke test the entry points**

| Check | Command | Expected |
|---|---|---|
| Nginx health | `curl -fsS http://localhost/nginx-health` | `200` and a healthy body |
| API Swagger UI | `curl -fsS http://localhost/api/v1/docs` | HTML response (HTTP 200) |
| AI health | `curl -fsS http://localhost/ai/` or `curl -fsS http://localhost:3003/` | reachable |

- [ ] **Step 4.5: Playwright web verification matrix**

Following `AGENTS.md` "Web verification (Playwright MCP)" section:

1. `playwright_browser_navigate` to `http://localhost/`.
2. Resize to 375x812; `browser_emulate_media` `colorScheme: dark`; `browser_snapshot`; `browser_take_screenshot` filename `.playwright-mcp/r03-landing-375-dark.png`.
3. `browser_emulate_media` `colorScheme: light`; `browser_snapshot`; `browser_take_screenshot` filename `.playwright-mcp/r03-landing-375-light.png`.
4. Resize to 768x1024; dark; screenshot `.playwright-mcp/r03-landing-768-dark.png`.
5. Resize to 1280x800; dark; screenshot `.playwright-mcp/r03-landing-1280-dark.png`.
6. With `reducedMotion: reduce`; dark; screenshot `.playwright-mcp/r03-landing-375-dark-reduced.png`.
7. `browser_console_messages` level `error`; assert no errors (HTTP requests to `api` and `ai-api` may return 401 before login; that is not a console error).

Pass criteria (from AGENTS.md): zero console errors apart from expected 401s before login; `<html lang>` set; `<main>` landmark; level-1 heading; focus ring visible; body contrast ≥ 4.5:1.

- [ ] **Step 4.6: Report status and screenshots**

Either:

```
Task 4 (R-03) status: DONE
All services healthy
Web verification: zero console errors
Screenshots: .playwright-mcp/r03-*.png
```

or:

```
Task 4 (R-03) status: BLOCKED
Missing secrets: <list>
```

---

### Task 5: R-05 Print owner-run cleanup instructions

**Files:**
- No code changes.

**Interfaces:**
- Consumes: nothing
- Produces: a printed checklist for the owner.

- [ ] **Step 5.1: Confirm R-03 status before recommending cleanup**

R-05 must only run after R-03 is `DONE` (the stack is verified up and the legacy containers are confirmed present). If R-03 was `BLOCKED`, do not recommend R-05 yet — the legacy `cervana_postgres` container is still the dev database. Halt and explain.

- [ ] **Step 5.2: Confirm legacy artifacts exist (so cleanup is meaningful)**

Run:

```
docker ps -a --format '{{.Names}}' | grep '^cervana_' || echo no_cervana_containers
docker volume ls --format '{{.Name}}' | grep '^cervana_' || echo no_cervana_volumes
docker network ls --format '{{.Name}}' | grep '^cervana_' || echo no_cervana_networks
ls -la .env.cervana.bak 2>/dev/null || echo no_env_backup
```

If all four say `no_*`, mark R-05 `DONE` (nothing to remove).

- [ ] **Step 5.3: Print the cleanup instructions**

Print to stdout verbatim from the execution plan:

```
[Owner action] Legacy R-05 cleanup:

docker rm cervana_postgres cervana_redis cervana_api
docker volume rm cervana_postgres_data cervana_redis_data
docker network rm cervana_network
rm .env.cervana.bak

For production:
  infra/scripts/migrate-legacy-volumes.sh
  infra/scripts/rename-legacy-databases.sh

Verify:
  docker ps -a                       # no cervana_*
  docker volume ls                    # no cervana_*
  ls -la .env.cervana.bak            # not found
```

- [ ] **Step 5.4: Report status**

```
Task 5 (R-05) status: PARTIAL
Instructions printed. Owner executes.
No file changes.
```

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task that implements it |
|---|---|
| R-02 § 5.1 (helper, tests, compose update, grep) | Task 1 |
| R-06 § 5.2 (compose cleanup, Dockerfile cleanup, image build) | Task 2 |
| R-04 § 5.3 (prisma migrate resolve + deploy + status + diff) | Task 3 |
| R-03 § 5.4 (bring-up, smoke tests, Playwright matrix) | Task 4 |
| R-05 § 5.5 (print cleanup instructions, no execution) | Task 5 |
| Codebase-memory-mcp audit (constraint) | Task 1 § 1.5, Task 2 § 2.2 |
| Playwright matrix (constraint) | Task 4 § 4.5 |
| No `git add`/`commit`/`push` (constraint) | All tasks, no Commit step |
| Status values (constraint) | All tasks |

No spec requirement is unassigned.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", or "add appropriate validation" patterns. Every command, expected output, and code block is explicit.

### 3. Type consistency

- `parseOrigins(raw: string | undefined): string[]` defined in Task 1 § 1.3. Used in Task 1 § 1.6 via `import { parseOrigins } from './common/lib/origins'`.
- Environment variables `CORS_EXTRA_ORIGINS` referenced in Task 1 § 1.6, § 1.7, § 1.8.
- Status strings `DONE`, `PARTIAL`, `BLOCKED` used consistently across all tasks.

No type or name drift between tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-01-track-r-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?