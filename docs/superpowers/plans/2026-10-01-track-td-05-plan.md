# Track TD-05 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adapted for this repo:** "Commit" steps in the standard template are replaced by "Report" steps. The agent never runs `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, or `git stash drop`. Staging and committing are owner responsibilities.

**Goal:** Add four database-invariant tests for the theme schema (`Theme_single_default` partial unique index, `Theme_default_is_published_global` CHECK, `Theme_tenant_scope` CHECK, `ON DELETE SET NULL` for curriculum FKs) so future schema regressions are caught at the test layer.

**Architecture:** Single task that appends one `describe('Theme invariants')` block to the existing `db-invariants.int.spec.ts` and adds one `insertTheme(c, opts?)` helper to `pg-fixtures.ts`. Reuses the existing `describeDb`, `withRollback`, `expectViolation`, `createPool` plumbing.

**Tech Stack:** Jest, `pg` driver via raw SQL, existing `pg-fixtures.ts` helpers (`insertUser`, `insertTenant`).

## Global Constraints

These constraints apply to every task. Sources: `AGENTS.md` and the V1 execution plan §2.

- **No comments in code, Dockerfiles, compose, nginx, or config files.** Variable names and function names carry the documentation.
- **Never run `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, or `git stash`.** Stage and commit are owner responsibilities.
- **No secrets in tracked files, docs, or logs.** Never print values from `.env`.
- **Never run `prisma format`.** It rewrites the whole schema file and was reverted once in Phase 1.
- **Never edit an applied migration.** The schema and migration `20260930130000_theme_foundation` are read-only for this plan.
- **For every zero-caller or "does not exist" claim**, run `codebase-memory-mcp`: `index_status`, `check_index_coverage`, `search_graph`, `trace_path` (direction `inbound`), `get_code_snippet`, plus `grep` confirmation.
- **Code, identifiers and docs in English.** User-facing web copy in Indonesian (n/a for this plan).
- **Status values:** `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never `DONE` for work not run.
- **Keep each task's diff reviewable.** If a task grows past ~400 changed lines, split it.

---

## File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/api/test-utils/pg-fixtures.ts` | Modify | Add `insertTheme(c, opts?)` helper for test setup |
| `services/api/src/v1/__tests__/db-invariants.int.spec.ts` | Modify | Append `describe('Theme invariants')` block with 4 tests |

No new files. No migration changes. No docker changes.

---

### Task 1: Theme invariant tests

**Files:**
- Modify: `services/api/test-utils/pg-fixtures.ts` (append `insertTheme` helper)
- Modify: `services/api/src/v1/__tests__/db-invariants.int.spec.ts` (append `describe('Theme invariants')` block at the bottom of the existing `describeDb(...)`)

**Interfaces:**
- Consumes: existing `PoolClient` from `pg`, `randomUUID()` (already imported in both files), existing helpers `insertUser`, `insertTenant`, `withRollback`, `expectViolation`, `describeDb`, `createPool` (all already imported in `db-invariants.int.spec.ts`).
- Produces: `insertTheme(c, opts?)` helper (from `pg-fixtures.ts`) used inside 4 new tests. Each test asserts the constraint name from `20260930130000_theme_foundation/migration.sql` (lines 67, 69, 71).

**Constraint names from the migration (verify against file at write time):**
- `Theme_single_default` — UNIQUE partial index (`CREATE UNIQUE INDEX "Theme_single_default" ON "Theme" ("isDefault") WHERE "isDefault"`)
- `Theme_default_is_published_global` — CHECK constraint (`ALTER TABLE "Theme" ADD CONSTRAINT "Theme_default_is_published_global" CHECK (NOT "isDefault" OR ("status" = 'PUBLISHED' AND "scope" = 'GLOBAL'))`)
- `Theme_tenant_scope` — CHECK constraint (`ALTER TABLE "Theme" ADD CONSTRAINT "Theme_tenant_scope" CHECK (("scope" = 'GLOBAL' AND "tenantId" IS NULL) OR ("scope" = 'TENANT' AND "tenantId" IS NOT NULL))`)

- [ ] **Step 1: Append `insertTheme` helper to `pg-fixtures.ts`**

Open `services/api/test-utils/pg-fixtures.ts`. Locate the existing `insertArticle` / `insertTenant` / `insertUser` cluster. Append (next to them, matching the file's grouping style — alphabetical if the file is alphabetical, thematic otherwise):

```typescript
export interface InsertThemeOptions {
  slug?: string;
  title?: string;
  primary?: string;
  secondary?: string;
  status?: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED';
  scope?: 'GLOBAL' | 'TENANT';
  tenantId?: string | null;
  isDefault?: boolean;
}

export async function insertTheme(
  c: PoolClient,
  o: InsertThemeOptions = {},
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = o.slug ?? `theme-${id}`;
  const status = o.status ?? 'PUBLISHED';
  const scope = o.scope ?? 'GLOBAL';
  const tenantId = o.tenantId ?? null;
  const isDefault = o.isDefault ?? false;
  await c.query(
    `INSERT INTO "Theme" (
       id, slug, title, description, primary, secondary, tertiary, quaternary,
       "bg_image", "planet_image",
       status, scope, "tenantId", "isDefault", version, mood, tokens, atmosphere, variants, provenance,
       "createdById", "publishedAt", "archivedAt",
       "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, NULL, $4, $5, NULL, NULL,
       NULL, NULL,
       $6, $7, $8, $9, 1, ARRAY[]::TEXT[], NULL, NULL, NULL, NULL, NULL,
       NULL, NULL, NULL,
       now(), now()
     )`,
    [id, slug, o.title ?? 'Theme', o.primary ?? '#000000', o.secondary ?? '#FFFFFF', status, scope, tenantId, isDefault],
  );
  return { id, slug };
}
```

This column order matches `services/api/prisma/schema.prisma` lines 829-870 exactly. `randomUUID` is already imported at the top of `pg-fixtures.ts` (used by other `insert*` helpers).

- [ ] **Step 2: Append the 4-test block to `db-invariants.int.spec.ts`**

Open `services/api/src/v1/__tests__/db-invariants.int.spec.ts`. Find the closing brace of the existing `describeDb(...)` block. Append a new `describe('Theme invariants', ...)` block **inside** the `describeDb(...)` so the `Pool` lifecycle is shared.

```typescript
  describe('Theme invariants', () => {
    it('deleting a theme keeps curriculum rows with themeId null', () =>
      withRollback(pool, async (c) => {
        const theme = await insertTheme(c);
        const topicId = randomUUID();
        const subTopicId = randomUUID();
        const lessonId = randomUUID();
        const stepId = randomUUID();
        await c.query(
          `INSERT INTO "Topic" (id, slug, title, image, price, "isVerified", "topicDuration", "createdAt", "updatedAt") VALUES ($1, $2, 't', '{}'::jsonb, 0, false, 30, now(), now())`,
          [topicId, `t-${topicId}`],
        );
        await c.query(
          `INSERT INTO "SubTopic" (id, "topicId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'st', 1, now(), now(), $3)`,
          [subTopicId, topicId, theme.id],
        );
        await c.query(
          `INSERT INTO "Lesson" (id, "subTopicId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'ls', 1, now(), now(), $3)`,
          [lessonId, subTopicId, theme.id],
        );
        await c.query(
          `INSERT INTO "Step" (id, "lessonId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'sp', 1, now(), now(), $3)`,
          [stepId, lessonId, theme.id],
        );
        await c.query(`DELETE FROM "Theme" WHERE id = $1`, [theme.id]);
        const sub = await c.query(`SELECT "themeId" FROM "SubTopic" WHERE id = $1`, [subTopicId]);
        const les = await c.query(`SELECT "themeId" FROM "Lesson" WHERE id = $1`, [lessonId]);
        const stp = await c.query(`SELECT "themeId" FROM "Step" WHERE id = $1`, [stepId]);
        expect(sub.rows[0].themeId).toBeNull();
        expect(les.rows[0].themeId).toBeNull();
        expect(stp.rows[0].themeId).toBeNull();
      }));

    it('rejects a second isDefault = true', () =>
      withRollback(pool, async (c) => {
        await insertTheme(c, { isDefault: true });
        const result = await expectViolation(
          c,
          `INSERT INTO "Theme" (id, slug, title, primary, secondary, status, scope, "isDefault", version, mood, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, 'dup', '#000000', '#FFFFFF', 'PUBLISHED', 'GLOBAL', true, 1, ARRAY[]::TEXT[], now(), now())`,
          [`dup-${randomUUID()}`],
        );
        expect(result.constraint).toBe('Theme_single_default');
      }));

    it('rejects a default theme that is not PUBLISHED and GLOBAL', () =>
      withRollback(pool, async (c) => {
        const result = await expectViolation(
          c,
          `INSERT INTO "Theme" (id, slug, title, primary, secondary, status, scope, "isDefault", version, mood, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, 'bad', '#000000', '#FFFFFF', 'DRAFT', 'GLOBAL', true, 1, ARRAY[]::TEXT[], now(), now())`,
          [`bad-${randomUUID()}`],
        );
        expect(result.constraint).toBe('Theme_default_is_published_global');
      }));

    it('rejects TENANT scope without tenantId', () =>
      withRollback(pool, async (c) => {
        const result = await expectViolation(
          c,
          `INSERT INTO "Theme" (id, slug, title, primary, secondary, status, scope, "isDefault", version, mood, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, 'orphan-tenant', '#000000', '#FFFFFF', 'PUBLISHED', 'TENANT', false, 1, ARRAY[]::TEXT[], now(), now())`,
          [`orphan-${randomUUID()}`],
        );
        expect(result.constraint).toBe('Theme_tenant_scope');
      }));
  });
```

- [ ] **Step 3: Run the new tests in isolation to verify they pass**

Run:
```
cd services/api
TEST_DATABASE_URL=postgresql://<user>:<pw>@<host>:5432/<db> \
  pnpm jest src/v1/__tests__/db-invariants.int.spec.ts -t 'Theme invariants'
```

Expected: 4 tests pass (or all pass including pre-existing ones if `-t` filter is not available).

If `TEST_DATABASE_URL` is not set, the suite skips — that is the existing behavior and is expected.

- [ ] **Step 4: Run the full suite to verify no regressions**

Run:
```
cd services/api
TEST_DATABASE_URL=postgresql://<user>:<pw>@<host>:5432/<db> \
  pnpm jest src/v1/__tests__/db-invariants.int.spec.ts
```

Expected: pre-existing tests still pass (count before vs. after: should grow by 4). If any pre-existing test fails, stop — investigate.

- [ ] **Step 5: Report changed files and test counts**

Print to the implementer's report file:

```
Task 1 (TD-05) status: <DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED>

Files touched:
- services/api/test-utils/pg-fixtures.ts (modified)
- services/api/src/v1/__tests__/db-invariants.int.spec.ts (modified)

Test counts (before vs. after):
- Pre-existing tests in db-invariants.int.spec.ts: <N>
- New tests: 4 (Theme invariants block)
- Total expected: <N + 4>

pnpm jest command and exit status (or "skipped, no TEST_DATABASE_URL").

Concerns (if any).
```

Do not run `git add`/`commit`/`push`. Do not print values from `.env`. Do not edit applied migrations.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task that implements it |
|---|---|
| Add `insertTheme` helper to `pg-fixtures.ts` | Task 1 §Step 1 |
| Append `describe('Theme invariants')` block with 4 tests | Task 1 §Step 2 |
| Test 1: deleting a theme keeps curriculum rows | Task 1 §Step 2 (first `it`) |
| Test 2: second `isDefault = true` fails | Task 1 §Step 2 (second `it`) |
| Test 3: default not `PUBLISHED` and `GLOBAL` rejected | Task 1 §Step 2 (third `it`) |
| Test 4: `TENANT` scope without `tenantId` rejected | Task 1 §Step 2 (fourth `it`) |
| `pnpm jest` verification | Task 1 §Steps 3 and 4 |
| Final report with changed files and test counts | Task 1 §Step 5 |

No spec requirement is unassigned.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", "fill in details", "add appropriate validation", "similar to Task 1" patterns. Every code block is verbatim.

### 3. Type consistency

- `insertTheme(c: PoolClient, o: InsertThemeOptions = {})` returns `{ id: string; slug: string }` (defined in Step 1, used in Step 2).
- `InsertThemeOptions` interface (Step 1) matches what `insertTheme` destructures (Step 1) and what tests pass (Step 2).
- Constraint name strings (`Theme_single_default`, `Theme_default_is_published_global`, `Theme_tenant_scope`) match `20260930130000_theme_foundation/migration.sql` lines 67, 69, 71.
- `pool`, `withRollback`, `expectViolation`, `describeDb`, `randomUUID` are all already imported / in scope in `db-invariants.int.spec.ts`.

No type drift between steps.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-01-track-td-05-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?