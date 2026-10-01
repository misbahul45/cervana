# Track TG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adapted for this repo:** "Commit" steps in the standard template are replaced by "Report" steps. The agent never runs `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, or `git stash drop`. Staging and committing are owner responsibilities.

**Goal:** Expose `ThemeProposerService` (algorithmic HSL-based theme generator) via `POST /v1/gamify/themes/propose` with body-validation + proposal-validation via `validateForPublish`. Admin-only.

**Architecture:** Single controller method + module provider edit. The endpoint uses the existing deterministic generator and validator; no LLM, no DB writes, no schema migration.

**Tech Stack:** NestJS 11 controllers + decorators, Prisma 7 (no schema change), Zod (already in repo), existing `ThemeProposerService` and `validateForPublish`.

## Global Constraints

These constraints apply to every task. Sources: `AGENTS.md` and the V1 execution plan §2.

- **No comments in code, Dockerfiles, compose, nginx, or config files.** Variable names and function names carry the documentation.
- **Never run `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, or `git stash`.** Stage and commit are owner responsibilities.
- **No secrets in tracked files, docs, or logs.** Never print values from `.env`.
- **Never run `prisma format`.** Never edit an applied migration.
- **Code, identifiers and docs in English.**
- **Status values:** `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never `DONE` for work not run.
- **Keep each task's diff under ~400 changed lines.** When 400+ lines, split.

---

## File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/api/src/v1/gamify/themes/themes.module.ts` | Modify | Register `ThemeProposerService` |
| `services/api/src/v1/gamify/themes/themes.controller.ts` | Modify | Add `@Post('propose')` method |
| `services/api/src/v1/gamify/themes/__tests__/themes-propose.spec.ts` | Create | Endpoint + validation tests

No new files outside the three above. No Prisma migration. No `package.json` change.

---

### Task 1: Register `ThemeProposerService` in `themes.module.ts`

**Files:**
- Modify: `services/api/src/v1/gamify/themes/themes.module.ts`

**Interfaces:**
- Consumes: existing `ThemeProposerService` (`services/api/src/v1/gamify/themes/theme-proposer.service.ts`).
- Produces: module providers + exports list with `ThemeProposerService`.

- [ ] **Step 1: Open the module file and verify the current shape**

Run: `cat services/api/src/v1/gamify/themes/themes.module.ts`

Expected: `@Module({ controllers: [ThemesController], providers: [ThemesService, ThemesRepo], imports: [PrismaModule], exports: [ThemesService, ThemesRepo] })`.

- [ ] **Step 2: Add the import and register `ThemeProposerService`**

Replace the file body with:

```ts
import { Module } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';
import { ThemeProposerService } from './theme-proposer.service';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ThemesRepo } from './themes.repo';

@Module({
  controllers: [ThemesController],
  providers: [ThemesService, ThemesRepo, ThemeProposerService],
  imports: [PrismaModule],
  exports: [ThemesService, ThemesRepo, ThemeProposerService],
})
export class ThemeModule {}
```

- [ ] **Step 3: Verify the import path resolves**

Run: `ls services/api/src/v1/gamify/themes/theme-proposer.service.ts`

Expected: file exists.

---

### Task 2: Add `@Post('propose')` to `ThemesController`

**Files:**
- Modify: `services/api/src/v1/gamify/themes/themes.controller.ts`

**Interfaces:**
- Consumes: injected `ThemeProposerService` (Task 1); `validateForPublish` from `./theme-validator`.
- Produces: HTTP endpoint `POST /v1/gamify/themes/propose` (admin-only) that returns `{ proposal, validation }` with status 200 or 400.

- [ ] **Step 1: Read the controller and confirm the constructor signature**

Run: `cat services/api/src/v1/gamify/themes/themes.controller.ts`

Confirm: existing constructor takes `private readonly themeService: ThemesService`. Add the second dep in Step 2.

- [ ] **Step 2: Add imports + dep + method**

Replace the top of the file (imports + class start) with:

```ts
import { AuthenticatedOnly } from '@/common/authz/access';
import { Public, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { ThemesService } from './themes.service';
import {
  CreateThemeIconType,
  CreateThemeType,
  UpdateThemeType,
} from './themes.dto';
import { Query as QueryInterface } from '@/common/interfaces';
import type { ThemeStateKey } from './theme-state';
import { ThemeProposerService, type Mood } from './theme-proposer.service';
import { validateForPublish } from './theme-validator';

interface AuthenticatedRequest {
  user: { id: string; role: Role };
}

@Controller('themes')
export class ThemesController {
  constructor(
    private readonly themeService: ThemesService,
    private readonly themeProposer: ThemeProposerService,
  ) {}
```

Append the new method at the end of the `ThemesController` class (after the last existing method):

```ts
  @Post('propose')
  @Roles(Role.ADMIN)
  async propose(@Body() body: unknown) {
    const parsed = z.object({
      name: z.string().min(1).max(120),
      level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      keywords: z.array(z.string().min(1).max(60)).max(20).optional(),
      mood: z
        .array(
          z.enum([
            'calm',
            'energetic',
            'analytical',
            'welcoming',
            'playful',
            'serious',
            'mysterious',
            'natural',
          ]),
        )
        .max(4)
        .optional(),
      intensity: z.number().min(0).max(1).optional(),
    }).safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'invalid_input', issues: parsed.error.issues });
    }
    const proposal = this.themeProposer.propose({
      name: parsed.data.name,
      level: parsed.data.level,
      keywords: parsed.data.keywords,
      mood: parsed.data.mood as Mood[] | undefined,
      intensity: parsed.data.intensity,
    });
    const validation = validateForPublish(proposal.tokens, proposal.atmosphere);
    if (!validation.ok) {
      throw new BadRequestException({ proposal, validation });
    }
    return { proposal, validation };
  }
```

The body validation uses inline Zod schema. The mood array cast (`as Mood[] | undefined`) is necessary because Zod's enum literal type matches but TypeScript does not infer through the array.

- [ ] **Step 3: Verify the file compiles**

Run: `cd services/api && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder pnpm build 2>&1 | tail -10`

Expected: exit 0; `tsc-alias` finishes without errors referencing `themes.controller.ts`.

If `validateForPublish` is exported under a different name or accepts different argument order, adjust the call site to match (read `theme-validator.ts` to confirm).

- [ ] **Step 4: Verify `pnpm jest src/v1/gamify/themes` passes (regression check)**

Run: `cd services/api && pnpm jest src/v1/gamify/themes/__tests__/theme-proposer.service.spec.ts src/v1/gamify/themes/__tests__/theme-validator.spec.ts src/v1/gamify/themes/__tests__/theme-normalize.spec.ts src/v1/gamify/themes/__tests__/theme.schema.spec.ts src/v1/gamify/themes/__tests__/theme-asset-policy.spec.ts src/v1/gamify/themes/__tests__/theme-state.spec.ts`

Expected: exit 0; existing tests still pass.

---

### Task 3: Create the endpoint test

**Files:**
- Create: `services/api/src/v1/gamify/themes/__tests__/themes-propose.spec.ts`

**Interfaces:**
- Consumes: existing `http-harness` (or analogous) test setup; the new `POST /v1/gamify/themes/propose` endpoint.
- Produces: 3 test cases (happy path, schema failure, validation failure if deterministically reachable).

- [ ] **Step 1: Inspect existing theme spec files to copy the test pattern**

Run: `head -50 services/api/src/v1/gamify/themes/__tests__/theme-proposer.service.spec.ts` and `head -50 services/api/src/v1/gamify/themes/__tests__/theme-validator.spec.ts`

Identify: how tests bootstrap (NestJS `Test.createTestingModule`, supertest, etc.); how authenticated requests are made; how ADMIN role is granted.

- [ ] **Step 2: Write `themes-propose.spec.ts`**

Create the file with the pattern observed in Step 1. Cover:

1. **Happy path**: send `POST /v1/gamify/themes/propose` with `{ name: 'Akademik', level: 'intermediate', mood: ['calm'], intensity: 0.5 }`. Assert: status 200, body has `proposal.slug` set, `validation.ok === true`, `proposal.tokens.light.primary` is a `#RRGGBB` string.
2. **Schema failure**: send `POST /v1/gamify/themes/propose` with `{ name: '' }`. Assert: status 400, body has `error: 'invalid_input'`.
3. **Validation failure** (best-effort): if a deterministic input reliably produces `validation.ok === false`, assert status 400 with `validation.issues.length > 0`. If no input does (because `propose` clamps values), document with `it.skip('no deterministic failure input', ...)` and a one-line comment noting this. Do not invent a failure path that does not exist.

- [ ] **Step 3: Run the new test**

Run: `cd services/api && pnpm jest src/v1/gamify/themes/__tests__/themes-propose.spec.ts`

Expected: exit 0; all 3 tests pass (or 2 pass + 1 skipped with the documented reason).

If the test fails because the harness does not match the pattern, adjust the test to match the harness. Do not modify the endpoint to make the test pass.

- [ ] **Step 4: Run the full theme suite**

Run: `cd services/api && pnpm jest src/v1/gamify/themes`

Expected: exit 0; new test + all existing theme tests pass.

---

### Task 4: Final report

- [ ] **Step 1: Print changed files and verification outputs**

Print to stdout (this plan uses inline mode):

```
Files touched:
- services/api/src/v1/gamify/themes/themes.module.ts (modified)
- services/api/src/v1/gamify/themes/themes.controller.ts (modified)
- services/api/src/v1/gamify/themes/__tests__/themes-propose.spec.ts (created)

Verification:
- pnpm build → exit 0
- pnpm jest src/v1/gamify/themes → exit 0
- new endpoint POST /v1/gamify/themes/propose with valid input → 200 { proposal, validation: { ok: true } }
- new endpoint with empty name → 400 { error: 'invalid_input' }
- (best-effort) new endpoint with adversarial mood/intensity → 400 { validation: { ok: false, issues: [...] } } OR skipped

Concerns (if any).
```

Do not run `git add`/`commit`/`push`. Do not print values from `.env`. Do not write code comments.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task that implements it |
|---|---|
| Register `ThemeProposerService` in `themes.module.ts` | Task 1 |
| Add `@Post('propose')` with `@Roles(Role.ADMIN)` | Task 2 §Steps 1-2 |
| Body validation via inline Zod | Task 2 §Step 2 |
| Validate via `validateForPublish` (TG-04) | Task 2 §Step 2 |
| Return 200 with `{ proposal, validation: { ok: true } }` | Task 2 §Step 2 |
| Return 400 with `{ proposal, validation: { ok: false, issues: [...] } }` on validation failure | Task 2 §Step 2 |
| Create `themes-propose.spec.ts` covering happy + schema + validation paths | Task 3 |
| Regression: existing theme tests pass | Task 2 §Step 4 + Task 3 §Step 4 |
| Build green | Task 2 §Step 3 |
| Final report | Task 4 |

No spec requirement is unassigned.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", "fill in details", "similar to Task 1" patterns. Controller code, Zod schema, and test skeleton are verbatim.

### 3. Type consistency

- `propose(input: ThemeProposalInput): ThemeProposal` — pre-existing; Task 2 §Step 2 calls it with the validated subset.
- `validateForPublish(tokens, atmosphere): { ok: boolean; issues: Issue[] }` — assumed signature; if the actual signature differs, the implementer adjusts in Step 3 of Task 2.
- `Mood` import from `theme-proposer.service` — exported there.
- Controller `@Body() body: unknown` + inline Zod — same pattern as other Nest controllers in this repo (verify with `theme-proposer.service.spec.ts` if it uses a request body, or follow the existing `themes.controller.ts` style).

No drift between tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-01-track-tg-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?