# Track R — Repository and Operations

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.1.
> Scopes Track R only. Does not include Track TD, TT, S, TU, B, TG, A, Q.
> No code has been written at the time of this draft.

---

## 1. Context

The ReduCera repository was restructured on 2026-09-30 (commit history `4507299 add cervana` through `999bbb2 feat: implement payouts and refunds functionality`). The audit and Phase 1+3 reports document the current state.

Track R is the first track of the V1 execution plan. It contains five tasks (R-02 through R-06) that prepare the repository for the database, theme, SSR, UI, branding, generator, accounting and quality tracks that follow.

R-01 is already complete (readme rewritten per P-11).

---

## 2. Goal

Execute Track R of the V1 execution plan to a verifiable state:

- CORS configuration is environment-driven, not hard-coded.
- No local-model plumbing (volumes, env vars) remains in the compose files or the `ai-api` Dockerfile, because embeddings are remote via Hugging Face Inference.
- The dev database `reducera` (empty, 58 tables, no `_prisma_migrations` table) is baselined and at head.
- The full stack `docker compose up -d --build` is brought up and verified healthy, or the blocker is named.
- The owner-run cleanup of legacy `cervana_*` containers, volumes and networks is documented and ready to execute.

---

## 3. Scope

### 3.1 In scope

| ID | Task | Source |
|---|---|---|
| R-02 | CORS hard-coded origin → env `CORS_EXTRA_ORIGINS` (comma-separated) | execution plan §8.1 R-02 |
| R-06 | Remove local-model plumbing (`hf_cache`, `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT`) | execution plan §8.1 R-06 |
| R-04 | Baseline dev database `reducera` with `prisma migrate resolve --applied` for the five pre-Phase-1 migrations, then `migrate deploy` | execution plan §8.1 R-04 |
| R-03 | Bring up the full stack and verify it is healthy | execution plan §8.1 R-03 |
| R-05 | Print owner-run cleanup instructions | execution plan §8.1 R-05 |

### 3.2 Out of scope

- Track TD (database theme schema).
- Track TT (theme layer, Zod contract, validator, asset policy, service hardening).
- Track S (SSR fixes, duplicate request removal, sharp binary, SEO preview image, test runner).
- Track TU (UI theme shell, brand logo, contrast, accessibility).
- Track B (copy rewrite, SEO meta, OG image, banned-terms guard).
- Track TG (theme generator endpoint).
- Track A (accounting content, sandbox).
- Track Q (test runner, lint, pre-existing test failures).

These are queued behind Track R per the dependency graph `R → TD → TT → S → TU → B → TG → A → Q`.

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx or config files |
| `AGENTS.md` | Never `git add`, `commit`, `push`, `reset --hard`, `rebase`, `stash drop` |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never `prisma format` |
| `AGENTS.md` | Never edit an applied migration |
| `AGENTS.md` | Test only on a scratch database, never the dev one (R-04 is the documented exception per Phase 1 rehearsal) |
| `AGENTS.md` | Code audit with `codebase-memory-mcp` for every zero-caller or "does not exist" claim, confirmed with `grep` |
| `AGENTS.md` | Web verification with Playwright MCP for any change that affects what the web renders |
| execution plan §2 | Code, identifiers and docs in English; user-facing web copy in Indonesian (n/a for Track R) |
| execution plan §2 | Keep each task's diff reviewable; if a task grows past ~400 changed lines, split it |

---

## 4. Approach

Sequential execution in the canonical order: R-02, R-06, R-04, R-03, R-05.

- R-02 first because it is independent, low risk, and reversible.
- R-06 second because it is independent, low risk, and reversible.
- R-04 third because the database must be ready before R-03 can succeed.
- R-03 fourth. Blocked without owner-provided secrets; will be marked `BLOCKED` and instructions printed if secrets are missing.
- R-05 last. The agent only prints the instructions; the owner executes.

---

## 5. Task breakdown

### 5.1 R-02 — CORS env migration

| Field | Value |
|---|---|
| Source | `services/api/src/main.ts:28-34`, `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example` |
| Type | Refactor |

**Changes**:

1. Create `services/api/src/common/lib/origins.ts` exporting `parseOrigins(raw: string | undefined): string[]`. Helper behaviour: returns `[]` for `undefined` or empty; splits on `,`; trims whitespace; drops empty entries; returns the array.
2. Create `services/api/src/common/lib/origins.spec.ts` covering: undefined → `[]`; empty string → `[]`; `"https://a"` → `["https://a"]`; `"https://a,https://b"` → both; `"  https://a ,  "` → first only; mixed case scheme preserved.
3. Update `services/api/src/main.ts:28-34` to read `process.env.CORS_EXTRA_ORIGINS` and merge with the dev-only defaults (`localhost:3000`, `localhost:3001`). Remove the hard-coded `https://cervana.vercel.app` literal from `main.ts`; the owner re-adds it via `CORS_EXTRA_ORIGINS` if the domain is still in use.
4. Update `.env.example` to declare `CORS_EXTRA_ORIGINS` (no comments per AGENTS.md; the variable name is the documentation).
5. Update both `docker-compose*.yml` `api` service environment to include `CORS_EXTRA_ORIGINS=${CORS_EXTRA_ORIGINS:-}`.

**Verify**:

| Check | Command | Expected |
|---|---|---|
| Origin helper tests | `cd services/api && pnpm jest src/common/lib/origins.spec.ts` | exit 0 |
| Full Jest suite | `cd services/api && pnpm jest --silent` | exit 0; no regressions |
| Compose validity (dev) | `docker compose config -q` | exit 0 |
| Compose validity (prod) | `docker compose -f docker-compose.prod.yml config -q` | exit 0 |
| Hard-coded origin removed | `grep -rn "cervana.vercel.app" services/api/src` | empty |

### 5.2 R-06 — Remove local-model plumbing

| Field | Value |
|---|---|
| Source | `docker-compose.yml`, `docker-compose.prod.yml`, `services/ai-api/Dockerfile:47-53` |
| Type | Removal |

**Pre-check**: `grep -rn "huggingface_hub\|transformers\|sentence_transformers" services/ai-api --include=*.py` must return empty. If non-empty, stop and report.

**Changes**:

1. Remove `hf_cache` named volume declaration from `docker-compose.yml` and `docker-compose.prod.yml`.
2. Remove from `ai-api` service and `celery-worker` service (if present) environment: `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT`.
3. Keep `HF_TOKEN` in `ai-api` and `celery-worker` environments.
4. Update `services/ai-api/Dockerfile` lines 47-53: remove ENV declarations for `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT`. Keep `HF_TOKEN` if present.

**Verify**:

| Check | Command | Expected |
|---|---|---|
| Pre-check empty | `grep -rn "huggingface_hub\|transformers\|sentence_transformers" services/ai-api --include=*.py` | empty |
| Compose validity (dev) | `docker compose config -q` | exit 0 |
| Compose validity (prod) | `docker compose -f docker-compose.prod.yml config -q` | exit 0 |
| Image builds | `docker compose build ai-api` | exit 0 |
| Service reachable | `curl -fsS http://localhost:3003/` (only if stack up) | exit 0 or skipped |

**### 5.3 R-04 — Baseline dev database `reducera`

| Field | Value |
|---|---|
| Source | `services/api/prisma/migrations` |
| Type | Migration state management |

**Pre-check**:

1. `docker compose ps postgres` must be healthy.
2. `DATABASE_URL` must point to the dev database `reducera` (the agent uses the user's gitignored `.env`, never prints values).
3. `psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"` should return 58.

If Postgres is not running, the task halts and the agent reports. The agent does not start Postgres itself in Track R.

**Changes**:

For each migration in order:
- `20251202032210_final_db`
- `20251202230940_final_db`
- `20260115090000_idempotency_key`
- `20260115100000_domain_model`
- `20260115110000_content_job_fields`

Run: `cd services/api && npx prisma migrate resolve --applied <migration>`.

Then: `cd services/api && npx prisma migrate deploy`.

**Verify**:

| Check | Command | Expected |
|---|---|---|
| Status up to date | `cd services/api && npx prisma migrate status` | "Database schema is up to date" |
| No drift | `cd services/api && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | empty output |

If `prisma migrate deploy` fails, run `npx prisma migrate resolve --rolled-back <migration>` per failing migration and report.

**### 5.4 R-03 — Bring up full stack

| Field | Value |
|---|---|
| Source | root `docker-compose.yml` |
| Type | Bring-up verification |

**Pre-check**:

Required secrets in `.env`:
- `INTERNAL_AI_API_SECRET` (generated by `openssl rand -base64 48`)
- `MANUAL_PAYMENT_ACCOUNTS` (JSON, real bank information)
- `OPENAI_API_KEY` (Flaz gateway key)

If any are missing, the task is `BLOCKED` and the agent prints the exact variable names that need to be filled by the owner. No value is printed or written by the agent.

**Changes**:

None. Bring-up only.

**Steps**:

1. `docker compose up -d --build`
2. Wait until `docker compose ps` shows all services healthy.
3. `curl -fsS http://localhost/nginx-health` (expect 200).
4. `curl -fsS http://localhost/api/v1/docs` (expect HTML response).
5. Playwright `/` at 375x812, 768x1024, 1280x800 with light and dark colour schemes, and `prefers-reduced-motion: reduce` once. Zero console errors.

**Verify**:

| Check | Command | Expected |
|---|---|---|
| All services healthy | `docker compose ps` | all `healthy` |
| Nginx health | `curl -fsS http://localhost/nginx-health` | 200 |
| API docs | `curl -fsS http://localhost/api/v1/docs` | HTML response |
| Web zero console errors | Playwright matrix | screenshots in `.playwright-mcp/`,` zero console errors |

**### 5.5 R-05 — Owner-run cleanup

| Field | Value |
|---|---|
| Source | execution plan §8.1 R-05 |
| Type | Documentation-only |

**Changes**:

None. The agent only prints the instructions from the execution plan. The owner runs them.

**Instructions to print (verbatim from execution plan)**:

```
docker rm cervana_postgres cervana_redis cervana_api
docker volume rm cervana_postgres_data cervana_redis_data
docker network rm cervana_network
rm .env.cervana.bak
```

Production: `infra/scripts/migrate-legacy-volumes.sh` and `infra/scripts/rename-legacy-databases.sh` with the stack stopped.

**Verify** (owner-side):

| Check | Command | Expected |
|---|---|---|
| No cervana containers | `docker ps -a` | no `cervana_*` rows |
| No cervana volumes | `docker volume ls` | no `cervana_*` rows |
| No `.env.cervana.bak` | `ls -la .env.cervana.bak` | not found |

The agent does not run the cleanup itself.

---

## 6. Verification protocol

### 6.1 Evidence per task

Every status value (`DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`) must be backed by:
- a command and its observed result, or
- a `file:line` reference.

The agent never writes `DONE` for work it did not run.

### 6.2 Codebase-memory-mcp audit

Before any "zero callers" or "does not exist" claim:
1. `list_projects` to confirm `home-misbahul45-code-reducera` is indexed.
2. `index_status` and `check_index_coverage` for every cited path or scope.
3. `search_graph` to find the symbol.
4. `trace_path` (direction `inbound`) for callers.
5. `get_code_snippet` for source.
6. `search_code` for graph-ranked text search.
7. `grep` to confirm graph results (the graph is best-effort; `parse_partial` files must be confirmed directly).

### 6.3 Playwright web verification

For any change that affects what the web renders (R-02 indirectly via `main.ts`; R-03 bring-up matrix):
- Viewports 375x812, 768x1024, 1280x800.
- Light and dark colour schemes.
- `reducedMotion: reduce` once.
- Screenshots → `.playwright-mcp/<name>.png` (the folder is gitignored).
- Pass criteria: zero console errors; `<html lang>` set; `<main>` landmark; level-1 heading in snapshot; visible focus ring; body contrast at least 4.5:1 (3:1 for large text and UI boundaries); decorative animation off with reduced motion.

### 6.4 Failure handling

- First failing task in the sequence: stop and report.
- No silent retry on non-idempotent operations (`prisma migrate deploy`, `docker compose up`).
- Idempotent operations may be retried (`pnpm jest`, `docker compose config -q`, file edits).

---

## 7. Risk register

| Task | Risk | Severity | Mitigation | Rollback |
|---|---|---|---|---|
| R-02 | CORS env typo blocks the web app from talking to the API | Low | Helper has unit tests; `docker compose config -q` catches invalid syntax | Edit `.env` or compose override |
| R-06 | A local-model env var that we missed is still referenced at runtime | Low | Pre-check grep on ai-api Python sources; image build smoke test | Re-add the env var in compose or Dockerfile |
| R-04 | `prisma migrate deploy` fails mid-way, leaving the schema inconsistent | High | Use `prisma migrate resolve --rolled-back <migration>` per failing migration; report and stop | Re-apply from a clean database; restore from backup |
| R-03 | Secrets missing | High (blocks bring-up) | List exact variable names; mark `BLOCKED`; do not invent values | Owner fills `.env` and re-runs |
| R-05 | Owner runs cleanup on production by mistake | High | The agent does not execute R-05; only prints instructions | Owner decides; the agent reports `PARTIAL` until confirmation |

---

## 8. Tools and skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `codebase-memory-mcp` | Graph audit (zero-caller, does-not-exist claims) |
| `bash` | Docker compose, Prisma, Jest, curl |
| `read`/`edit`/`write` | Source code changes |
| `grep`/`glob` | Text search |
| `playwright` MCP | Web verification during R-03 |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces the implementation plan |
| `subagent-driven-development` | Execution of R-02 through R-05 |
| `verification-before-completion` | Every task before claiming `DONE` |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review of this spec
  → writing-plans (produces plan doc)
  → user approval of plan
  → subagent-driven-development per task with checkpoint
  → final report (changed/untracked files, status per task)
```

---

## 9. Deliverables

1. This doc at `docs/superpowers/specs/2026-10-01-track-r-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-r-plan.md` (produced by `writing-plans`).
3. Track R executed with status per task:
   - R-02: `DONE` after helper + tests + compose updates + grep verification
   - R-06: `DONE` after compose + Dockerfile clean-up + image build
   - R-04: `DONE` after `prisma migrate deploy` succeeds and `migrate diff` is empty
   - R-03: `BLOCKED` if secrets are missing; `DONE` if bring-up verification passes
   - R-05: `PARTIAL` (instructions printed, owner executes)
4. Final report listing changed and untracked files. The agent does not stage, commit, or push.

---

## 10. Completion condition

The workflow is complete when:
- This spec is committed (owner action, not agent).
- The implementation plan exists and is approved by the owner.
- R-02 verified green: `pnpm jest` and `docker compose config -q` (both files) exit 0; `grep cervana.vercel.app services/api/src` is empty.
- R-06 verified green: `docker compose config -q` (both files) exit 0; ai-api image builds; `huggingface_hub`, `transformers`, `sentence_transformers` are absent from ai-api Python sources.
- R-04 verified green: `prisma migrate status` reports up to date; `prisma migrate diff` is empty.
- R-03 final status is `BLOCKED` (with the printed variable list) or `DONE` (with healthy stack evidence).
- R-05 final status is `PARTIAL` (instructions printed).
- The agent never ran `git add`, `git commit`, or `git push`.
- No secret value appears in any tracked file, doc, or log line.

---

## 11. Open questions

| ID | Question | Decision owner | Default |
|---|---|---|---|
| Q-R-01 | Is `https://cervana.vercel.app` still a valid production origin in the owner's runtime config? | owner | If unknown, drop the literal from `main.ts` defaults; the owner re-adds it via `CORS_EXTRA_ORIGINS` if needed |
| Q-R-02 | Does the dev database `reducera` have a backup before R-04 runs? | owner | Required; if not, the agent halts R-04 |
| Q-R-03 | Should R-03 attempt bring-up if only some secrets are present? | owner | No; any missing required secret → `BLOCKED` |

---

## 12. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.1 (Track R source of truth).
- [`docs/progress-tracker.md`](../../progress-tracker.md) (P-01 through P-12 marked done; IMPL-01 Phase 0 still `[ ]`).
- [`docs/architecture/PHASE_1_REPORT.md`](../../architecture/PHASE_1_REPORT.md) (R-04 rehearsal sequence).
- [`docs/architecture/PHASE_3_REPORT.md`](../../architecture/PHASE_3_REPORT.md) (current payment/commerce baseline).
- `AGENTS.md` (rules: no comments, no destructive git, codebase-memory-mcp audit, Playwright verification, secrets policy).