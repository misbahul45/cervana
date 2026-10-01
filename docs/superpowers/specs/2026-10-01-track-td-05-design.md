# Track TD-05 — Invariant Tests

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.2.
> Scopes the remaining TD-05 task only. Other TD tasks (TD-01, TD-02, TD-03, TD-04) are already complete in the repo.

---

## 1. Context

Track TD is the database foundation for the theme layer. The execution plan §8.2 specifies five tasks (TD-01 through TD-05):

- TD-01 Schema: ✅ complete. `services/api/prisma/schema.prisma` lines 829-870 cover `Theme` (with `slug`, `status`, `scope`, `tenantId`, `isDefault`, `version`, `mood`, `tokens`, `atmosphere`, `variants`, `provenance`, `createdById`, `publishedAt`, `archivedAt`) and `ThemeIcon`. `Topic`, `SubTopic`, `Lesson`, `Step` all have nullable `themeId`.
- TD-02 Migration: ✅ complete. `services/api/prisma/migrations/20260930130000_theme_foundation/migration.sql` applies the enums, columns, indexes, foreign keys, and three hand-written invariants (partial unique index, two CHECK constraints).
- TD-03 Delete safety: ✅ complete. Foreign keys changed from `Cascade` to `SetNull`.
- TD-04 Seed default theme: ✅ complete. `services/api/prisma/seed-theme.ts` + `services/api/prisma/seed-data/reducera-ocean.theme.json` + `package.json` script `seed:theme`.
- TD-05 Invariant tests: **incomplete**. `services/api/src/v1/__tests__/db-invariants.int.spec.ts` exists with 403 lines of order/payment/tenant tests, but no theme-specific tests.

This spec closes TD-05.

---

## 2. Goal

Add four database-invariant tests covering the theme constraints added in TD-02, so the next regression in the Theme schema is caught at the test layer instead of at runtime.

---

## 3. Scope

### 3.1 In scope

- Four new tests in `services/api/src/v1/__tests__/db-invariants.int.spec.ts` under a `describe('Theme invariants')` block:
  1. Deleting a theme keeps curriculum rows (SubTopic, Lesson, Step persist with `themeId = NULL`).
  2. A second `isDefault = true` insert fails (UNIQUE partial index `Theme_single_default`).
  3. A default that is not `PUBLISHED` and `GLOBAL` is rejected (CHECK constraint `Theme_default_is_published_global`).
  4. A `TENANT` scope without `tenantId` is rejected (CHECK constraint `Theme_tenant_scope`).
- One new helper `insertTheme(c, opts?)` in `services/api/test-utils/pg-fixtures.ts`.
- Verification: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/db-invariants.int.spec.ts` exits 0.

### 3.2 Out of scope

- TD-01, TD-02, TD-03, TD-04 (already complete).
- New migrations or schema changes.
- Track TT (theme layer Zod/validator/asset policy/service hardening), Track S (SSR fixes), Track TU (UI), Track B (copy/branding), Track TG (theme generator), Track A (accounting), Track Q (quality).
- Any change to existing test cases or other helpers in `pg-fixtures.ts`.

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never run `prisma format` |
| `AGENTS.md` | Test only on a scratch database, never the dev one. TD-05 uses the existing `TEST_DATABASE_URL` convention |
| execution plan §2 | Code, identifiers and docs in English. User-facing web copy in Indonesian (n/a) |
| execution plan §2 | Keep each task's diff reviewable |

---

## 4. Approach

Append four tests to the existing `db-invariants.int.spec.ts` (per the brief) and add a small `insertTheme` helper to `pg-fixtures.ts` (alongside the existing `insertArticle`, `insertTenant`, `insertUser`, `insertOrder`, `insertIntent`, `insertPayment`, `insertLedger`, `insertWallet`).

Why this approach:
- Matches the execution plan §8.2 TD-05 verbatim ("Invariant tests in `services/api/src/v1/__tests__/db-invariants.int.spec.ts`").
- Reuses the existing `describeDb`, `withRollback`, `expectViolation`, and `createPool` plumbing — no new test framework.
- Keeps `pg-fixtures.ts` as the single source of truth for `INSERT INTO` helpers, matching the existing convention.

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/api/src/v1/__tests__/db-invariants.int.spec.ts` | Modify | Append `describe('Theme invariants')` block with 4 tests |
| `services/api/test-utils/pg-fixtures.ts` | Modify | Add `insertTheme(c, opts?)` helper |

No new files. No migration changes.

---

## 6. Task Detail

### 6.1 Add `insertTheme` helper to `pg-fixtures.ts`

Append the following to `services/api/test-utils/pg-fixtures.ts` (alphabetical or thematic grouping; match the file's existing style — likely grouped near `insertArticle`):

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

Notes:
- Column order matches `schema.prisma` lines 829-870.
- `randomUUID` is already imported in `pg-fixtures.ts` (used by other `insert*` helpers).
- Defaults are chosen so a single `insertTheme(c)` call produces a valid, non-default theme (`PUBLISHED` + `GLOBAL` + `isDefault = false`).

### 6.2 Append `describe('Theme invariants')` to `db-invariants.int.spec.ts`

After the existing `describeDb(...)` block, add (still inside `describeDb`, so the `Pool` lifecycle is shared):

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
        await c.query(`INSERT INTO "SubTopic" (id, "topicId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'st', 1, now(), now(), $3)`, [subTopicId, topicId, theme.id]);
        await c.query(`INSERT INTO "Lesson" (id, "subTopicId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'ls', 1, now(), now(), $3)`, [lessonId, subTopicId, theme.id]);
        await c.query(`INSERT INTO "Step" (id, "lessonId", title, "sortOrder", "createdAt", "updatedAt", "themeId") VALUES ($1, $2, 'sp', 1, now(), now(), $3)`, [stepId, lessonId, theme.id]);
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

Notes:
- `randomUUID` is already imported in `db-invariants.int.spec.ts` (line 1).
- `insertUser`, `insertTenant`, `expectViolation`, `withRollback` are already imported.
- Constraint names match the names in `20260930130000_theme_foundation/migration.sql`:
  - `Theme_single_default` (line 67, CREATE UNIQUE INDEX ... WHERE "isDefault")
  - `Theme_default_is_published_global` (line 69, ADD CONSTRAINT ... CHECK)
  - `Theme_tenant_scope` (line 71, ADD CONSTRAINT ... CHECK)

### 6.3 Verify

```
cd services/api
TEST_DATABASE_URL=postgresql://<user>:<pw>@<host>:5432/<db> \
  pnpm jest src/v1/__tests__/db-invariants.int.spec.ts
```

Expected: all pre-existing tests pass + 4 new tests pass.

Without `TEST_DATABASE_URL`: same skip behavior as today (the suite skips without DB env).

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| Insert helper column order diverges from `schema.prisma` (insert fails with "column does not exist" or violates NOT NULL) | Low | Match column order verbatim from `schema.prisma:829-870`; co-located with schema | Edit helper to fix column list |
| `Theme_single_default` is a UNIQUE partial index (PG error code `23505`, constraint name `Theme_single_default`) — `expectViolation` returns the constraint name correctly | Low | `expectViolation` in `pg-fixtures.ts` reads `err.constraint`; tests assert the name, not the SQL code | If `expectViolation` returns something else, fall back to checking `err.code === '23505'` |
| Constraint name string mismatch between `migration.sql` and tests (typo in the assert) | Medium | Names verified at file write time against `migration.sql` lines 67, 69, 71 | Edit assert strings |
| Pre-existing tests break due to test order or DB state | Low | Every test uses `withRollback` (transactional); isolated | Investigate `withRollback` semantics; check for shared fixtures |
| `pg-fixtures.ts` exports — adding `insertTheme` may conflict with a future export (none currently named `insertTheme`) | Low | Name space is open; no collision risk | Rename to `insertThemeRow` if conflict found |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `codebase-memory-mcp` | Graph audit if zero-caller claims arise |
| `bash` | Jest, pnpm, psql for verification |
| `read`/`edit`/`write` | Source code changes |
| `grep`/`glob` | Locate helpers, verify schema column order |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces the implementation plan |
| `subagent-driven-development` | Execution of TD-05 |
| `verification-before-completion` | Before claiming DONE |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review of this spec
  → writing-plans (produces plan doc)
  → subagent-driven-development per task
  → final review
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-track-td-05-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-td-05-plan.md`.
3. Executed TD-05:
   - 4 tests added under `describe('Theme invariants')` in `db-invariants.int.spec.ts`.
   - `insertTheme(c, opts?)` helper added to `pg-fixtures.ts`.
   - `pnpm jest src/v1/__tests__/db-invariants.int.spec.ts` green with `TEST_DATABASE_URL` set.
4. Final report listing changed files and verification output.

---

## 10. Completion Condition

- This spec written and approved.
- Implementation plan written and approved.
- All 4 new tests pass with `TEST_DATABASE_URL` set.
- No pre-existing tests broken.
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.
- No `prisma format` run.
- No new files created outside the two modified files.
- Final report lists exact command of `pnpm jest ...` and the pre/post test totals.

---

## 11. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.2 (Track TD source of truth).
- `services/api/prisma/schema.prisma` lines 829-870 (Theme model).
- `services/api/prisma/migrations/20260930130000_theme_foundation/migration.sql` (constraint names).
- `services/api/prisma/seed-theme.ts` (TD-04 implementation reference).
- `services/api/src/v1/__tests__/db-invariants.int.spec.ts` (target file).
- `services/api/test-utils/pg-fixtures.ts` (helpers home).
- `AGENTS.md` (rules).