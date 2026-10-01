# Auto-import fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adapted for this repo:** "Commit" steps in the standard template are replaced by "Report" steps. The agent never runs `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, or `git stash drop`. Staging and committing are owner responsibilities.

**Goal:** Add `~/components/landingpage` to `components.dirs` in `apps/web/nuxt.config.ts` so components in the `landingpage/` subfolder are auto-importable without the `Landingpage` prefix. This unblocks the Track B-03 Playwright matrix.

**Architecture:** Single-line config change. Nuxt 4 deduplicates components across multiple `dirs` entries by relative path. The pre-existing `LandingpageHeroSection` export remains valid (it points to the same file via the `~/components` entry). Adding `~/components/landingpage` makes the same components available without the directory prefix.

**Tech Stack:** Nuxt 4, Vue 3 SFC, TypeScript. No new dependencies.

## Global Constraints

These constraints apply to every task. Sources: `AGENTS.md` and the V1 execution plan §2.

- **No comments in code, Dockerfiles, compose, nginx, or config files.** Variable names and function names carry the documentation.
- **Never run `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, or `git stash`.** Stage and commit are owner responsibilities.
- **No secrets in tracked files, docs, or logs.** Never print values from `.env`.
- **Never run `prisma format`.**
- **Code, identifiers and docs in English.**
- **Status values:** `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never `DONE` for work not run.
- **Keep the diff tiny.** The whole change should be ≤ 5 lines.

---

## File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `apps/web/nuxt.config.ts` | Modify (1-line addition to `components.dirs` array) | Register `~/components/landingpage` for prefix-less auto-import |

No new files. No migrations. No `package.json` change.

---

### Task 1: Add `~/components/landingpage` to `components.dirs`

**Files:**
- Modify: `apps/web/nuxt.config.ts`

**Interfaces:**
- Consumes: existing `components.dirs: ['~/components']` entry.
- Produces: `components.dirs: ['~/components', '~/components/landingpage']` so `HeroSection`, `CarrouselHome`, `FeatureSection`, and `OceanHero` (and any future `landingpage/` component) auto-import without the `Landingpage` prefix.

- [ ] **Step 1: Confirm no name collision at `~/components/HeroSection.vue`**

Run: `ls apps/web/app/components/HeroSection.vue 2>&1 || echo absent`
Expected: `No such file or directory` (output ends with "absent"). If present, abort this task — the `<HeroSection />` reference already resolves via the root `~/components` entry, and the proposed change would cause a name collision.

- [ ] **Step 2: Modify `components.dirs`**

Open `apps/web/nuxt.config.ts`. Locate the `components.dirs` array (lines 47-50 area). Change:

```ts
  components: {
    dirs: [
      '~/components',
    ]
  },
```

to:

```ts
  components: {
    dirs: [
      '~/components',
      '~/components/landingpage',
    ]
  },
```

Do not modify any other lines. Do not add comments.

- [ ] **Step 3: Build the web app**

Run: `cd apps/web && pnpm build`
Expected: exit 0; no Vue plugin errors. If the build fails, the most likely cause is a name collision (Step 1 missed something); read the error and decide whether to abort (rename one of the components instead of adding the dirs entry).

- [ ] **Step 4: Verify `HeroSection` is exported without prefix**

Run: `grep "^export const HeroSection\b" apps/web/.nuxt/components.d.ts`
Expected: at least one match (e.g., `export const HeroSection: typeof import(...)['default']`).

If no match, the build did not register the new prefix-less component. Abort and read the Nuxt docs / build output for guidance.

- [ ] **Step 5: Run the copy-guard test (no regression)**

Run: `cd apps/web && pnpm vitest run app/theme/__tests__/copy.test.ts`
Expected: exit 0 (2/2 passing — no regression).

- [ ] **Step 6: Report changed files and verification outputs**

Print to the implementer's report file:

```
Files touched:
- apps/web/nuxt.config.ts (modified; added '~/components/landingpage' to components.dirs)

Verification:
- pnpm build → exit 0
- grep HeroSection apps/web/.nuxt/components.d.ts → match
- copy-guard test → exit 0 (2/2 pass)

Concerns (if any).
```

Do not run `git add`/`commit`/`push`. Do not print values from `.env`. Do not write code comments.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task that implements it |
|---|---|
| `components.dirs` includes `~/components/landingpage` | Task 1 §Step 2 |
| `pnpm build` exits 0 | Task 1 §Step 3 |
| `HeroSection` (no prefix) registered in `apps/web/.nuxt/components.d.ts` | Task 1 §Step 4 |
| No regression in theme tests | Task 1 §Step 5 |
| Final report | Task 1 §Step 6 |

No spec requirement is unassigned.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", "fill in details", "similar to Task 1" patterns. The change is verbatim.

### 3. Type consistency

- `components.dirs` is `string[]`. No new types or functions.
- The new entry `'~/components/landingpage'` matches the existing format of the array.

No drift.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-01-autoimport-fix-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?