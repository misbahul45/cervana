# Track A-06 — Replace SKKNI vocational seed with golden graph

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.9 A-06, decision DC-11 (owner-confirm).
> Scopes only A-06. Other A tasks (A-01 through A-05) are already complete in the repo.

---

## 1. Context

Track A is the accounting-content-and-sandbox track. The execution plan §8.9 specifies six A tasks:

- A-01 Replace vocational seed with the golden accounting graph: **already done** via `services/api/prisma/seed-golden-graph.ts` (golden sub-topics, lessons, prerequisites).
- A-02 `SubTopicPrerequisite` relation: **already done** via migration `20261001090000_sub_topic_prerequisites`.
- A-03 Sandbox tables (`SandboxAccount`, `SandboxPeriod`, `SandboxScenario`, `SandboxTransaction`, `SandboxJournalLine`, `SandboxAttempt`): **already done** via migration `20261001100000_accounting_sandbox` and `services/api/prisma/schema.prisma`.
- A-04 `seed-golden-graph.ts` script: **already exists** (284 lines, idempotent).
- A-05 `AccountingSandboxService` deterministic validator: **already done** at `services/api/src/v1/sandbox/accounting-sandbox.service.ts` with passing tests (`accounting-sandbox.service.spec.ts`).
- A-06 Keep SKKNI vocational content out of the default seed: **incomplete**. `services/api/prisma/seed.ts` (1035 lines) still populates `Teknisi Akuntansi Yunior` SKKNI content (`subTopicMap`, `lessonStructure`, `generateSKKNIDescription`, `main()` orchestration). Decision DC-11 owner-confirm: replace SKKNI from default seed.

This spec closes A-06.

---

## 2. Goal

`pnpm seed` (or `cd services/api && tsx prisma/seed.ts`) populates only the golden accounting graph and the seeded theme; the SKKNI vocational content is no longer part of the default seed.

---

## 3. Scope

### 3.1 In scope

- Modify `services/api/prisma/seed.ts` so that running it produces the same end-state as running `seed-golden-graph` + `seed-theme` together, and no longer produces SKKNI vocational content.
- The exact mechanical approach (replace `main()`, delegate, or refactor into helpers) is open; the implementer chooses whichever yields the lowest diff while satisfying:
    - No SKKNI vocabulary appears in `seed.ts` after the change.
    - `tsx prisma/seed.ts` still exits 0 with the golden graph and the seeded theme present.
    - `tsx prisma/seed.ts` no longer writes "Teknisi Akuntansi Yunior", SKKNI competencies, or related vocational categories.
- Optional: rename `subTopicMap` and `lessonStructure` constants only if they are no longer referenced; otherwise drop them.

### 3.2 Out of scope

- A-01 through A-05 (already complete).
- Track R, TD, TT, S, B, TU (already complete).
- Track Q (quality/tests).
- Remove the mention of `seed-golden-graph` and `seed-theme` from `package.json` scripts — they stay (idempotent and useful standalone).
- Make `seed-golden-graph.ts` or `seed-theme.ts` callable as library functions; if their `main()` is currently top-level (auto-executed when imported), the implementer may add exports but is not required to.

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never run `prisma format` |
| execution plan §2 | Code, identifiers and docs in English. Web copy in Indonesian (n/a for the seed file) |

---

## 4. Approach

Approach A from brainstorming: replace `main()` and the SKKNI constants with a thin wrapper that calls the existing `seed-golden-graph` and `seed-theme` entry points. After the change:

- `seed.ts` is no longer the source of SKKNI content; the file exists as a single-source-of-truth entry point.
- The helper functions `generateSKKNIDescription`, `lessonStructure`, `subTopicMap`, `lessonIds`, `subTopicsId`, `themesData` (and any other SKKNI-bound data) are dropped.
- The `tsx prisma/seed.ts` invocation still runs the golden graph and the seeded theme.

The implementer may achieve this by:

1. Replacing `main()` with a call to the existing `main()` of `seed-golden-graph.ts` and `seed-theme.ts` (note: those auto-execute on import in the current shape, so the cleanest path is to dynamically `import()` them inside the new `main()`).
2. Or: replace `main()` with the body of the golden-graph seed (copy from `seed-golden-graph.ts`) plus a call to the theme seed; remove the SKKNI block entirely.

The implementer chooses whichever produces the smallest, cleanest diff.

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/api/prisma/seed.ts` | Modify | Default seed entry point; no SKKNI content |

No new files. No migrations.

---

## 6. Task Detail

### 6.1 Modify `seed.ts`

Open `services/api/prisma/seed.ts`.

Recommended mechanical change (the implementer may vary slightly):

1. Delete the SKKNI-specific declarations:
   - `const subTopicMap = { "Teknisi Akuntansi Yunior": [...] }`
   - `const lessonStructure = { "Teknisi Akuntansi Yunior": {...} }`
   - `const lessonIds = [...]` and `const subTopicsId = [...]` (if no longer referenced)
   - `const themesData = [...]` (the themes seed block — superseded by `seed-theme.ts`)
   - `function generateSKKNIDescription(level)` and any SKKNI description helpers
2. Delete the body of `main()` that writes SKKNI content (e.g., the loop that creates the "Teknisi Akuntansi Yunior" topic, its sub-topics, lessons, steps, and quiz templates).
3. Replace `main()` with a thin wrapper that runs the golden graph and theme seeds:

```ts
async function main(): Promise<void> {
  await import('./seed-golden-graph');
  await import('./seed-theme');
}
```

The `import()` side-effect runs each script's top-level `main()` (each calls `prisma.$disconnect()` via `.finally()`). Because the golden-graph script's `main()` connects to the same Prisma instance declared in its own file (not the one in `seed.ts`), the chain works as designed — both scripts connect, run, and disconnect independently.

If the implementer prefers a single shared `prisma` client, they can refactor by passing `prisma` into an exported function from each script. That refactor is permitted, but the goal is a smaller change, not a larger one.

4. The `process.exit(1)` and `.disconnect()` patterns in the replaced `main()` are not needed — each imported script's own `.finally()` handles its Prisma client.

If the implementer finds the import chain brittle (e.g. `seed-golden-graph` and `seed-theme` both create new `PrismaClient` instances that connect to the same DB; this is OK because they disconnect on `.finally`), they may inline the bodies. The inline path is a single-file change and is the safer choice; the import path is the more idiomatic choice.

### 6.2 Verify

| Check | Command | Expected |
|---|---|---|
| No SKKNI vocabulary | `grep -rn "SKKNI\|Teknisi Akuntansi\|sertifikasi" services/api/prisma/seed.ts` | empty |
| No references to old helpers | `grep -n "generateSKKNIDescription\|lessonStructure\|subTopicMap" services/api/prisma/seed.ts` | empty |
| Build green | `cd services/api && pnpm build` | exit 0 |
| Seed runs | `cd services/api && tsx prisma/seed.ts` | exit 0; populates only golden graph + theme (no SKKNI rows) |
| Regression | `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/db-invariants.int.spec.ts` | 24/24 pass |

### 6.3 Rollback (not needed for owner)

If the implementer discovers during verification that the SKKNI seed is still being written, the rollback is to revert the file change (git restore). The owner can stage the reverted change and recommit.

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| Import chain produces duplicate `PrismaClient` instances (each script has its own) | Low | Each script's `.finally()` calls `prisma.$disconnect()`. The DB handles two connections trivially | Inline the bodies instead of importing |
| Golden graph not idempotent → duplicate topic/sub-topic/lesson inserts on re-run | Low | `seed-golden-graph.ts` already has upsert-by-slug logic (per its existing tests). Pre-existing behavior | Investigate duplicates; the implementer should not introduce new dedup logic |
| `process.exit(1)` no longer wired up at `seed.ts` level | Low | Each imported script retains `.catch(error => process.exit(1))`. Top-level failure still exits 1 | Add back a try/catch around the `import()` block |
| Build lints flag unused imports (e.g., leftover `ref`, `computed` imports after deletion) | Low | Run `pnpm build` and remove any unused imports the linter flags | Delete the unused symbols |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `bash` | grep, build, vitest, tsx |
| `read`/`edit`/`write` | Source code changes |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces implementation plan |
| `executing-plans` | Execution (inline mode chosen) |
| `verification-before-completion` | Before claiming DONE |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review
  → writing-plans
  → executing-plans (this plan's tasks)
  → final report
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-track-a06-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-a06-plan.md`.
3. Executed A-06:
   - `services/api/prisma/seed.ts` no longer contains SKKNI vocabulary
   - `tsx prisma/seed.ts` runs only the golden graph and theme seeds
   - Regression: 24/24 db-invariants pass
4. Final report.

---

## 10. Completion Condition

- This spec written and approved.
- Implementation plan written and approved.
- `grep "SKKNI\|Teknisi Akuntansi\|sertifikasi" services/api/prisma/seed.ts` returns empty.
- `pnpm build` exits 0.
- `tsx prisma/seed.ts` exits 0 against the scratch DB.
- `pnpm jest src/v1/__tests__/db-invariants.int.spec.ts` reports 24/24 pass (with `TEST_DATABASE_URL`).
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.

---

## 11. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.9 (Track A source of truth).
- DC-11 owner-confirm (SKKNI out of default seed).
- `services/api/prisma/seed-golden-graph.ts` (golden graph body to reuse).
- `services/api/prisma/seed-theme.ts` (theme seed body to reuse).
- `services/api/prisma/migrations/20261001090000_sub_topic_prerequisites` (A-02).
- `services/api/prisma/migrations/20261001100000_accounting_sandbox` (A-03).
- `services/api/src/v1/sandbox/accounting-sandbox.service.ts` (A-05).
- `services/api/package.json` (`seed` script uses `prisma/seed.ts`; both `seed:golden-graph` and `seed:theme` exist).