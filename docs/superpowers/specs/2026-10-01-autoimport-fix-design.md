# Auto-import fix — Track B-03 Playwright blocker

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> This spec fixes the pre-existing Nuxt auto-import issue that blocked Playwright verification of `OceanHero.vue` (Track B-03). One-line change in `nuxt.config.ts`.

---

## 1. Context

During Track B-03 implementation, the implementer created `apps/web/app/components/brand/BrandLogo.vue` and `apps/web/app/components/landingpage/OceanHero.vue`, and modified `apps/web/app/components/landingpage/HeroSection.vue` to render `<OceanHero />`. Build green, copy guard green.

When the agent tried to verify visually with Playwright against a running `apps/web/.output/server/index.mjs`, the page rendered with title and h1 but **no `<svg>` elements in the document**. The hero block rendered as three empty placeholders (`<!---->` in SSR; `<herosection></herosection>` etc. in the client snapshot).

Root cause: Nuxt's `components: { dirs: ['~/components'] }` export behavior exports subfolder components with their directory name as a prefix. Per `apps/web/.nuxt/components.d.ts`:

```
export const LandingpageHeroSection: typeof import("../app/components/landingpage/HeroSection.vue")['default']
export const LazyLandingpageHeroSection: LazyComponent<typeof import("../app/components/landingpage/HeroSection.vue")['default']>
```

`apps/web/app/pages/index.vue:11` references `<HeroSection />` (without prefix), so the component never resolves. The `<HeroSection />`, `<CarrouselHome />`, and `<FeatureSection />` tags render as unresolved Web Components.

This was flagged as a pre-existing issue at the end of Track B-03 and parked. Owner has now asked to fix it.

---

## 2. Goal

Add `~/components/landingpage` to `components.dirs` in `apps/web/nuxt.config.ts` so that components in the `landingpage/` subfolder are auto-importable without the `Landingpage` prefix. This unblocks the Playwright matrix from `Track B-03 brief Step 8` and any other consumer page that uses `landingpage/` components.

---

## 3. Scope

### 3.1 In scope

- Modify `apps/web/nuxt.config.ts` `components.dirs` to include `~/components/landingpage`.
- Verify `pnpm build` exits 0.
- Verify the build manifest registers `HeroSection` (not just `LandingpageHeroSection`) for auto-import.

### 3.2 Out of scope

- Moving `HeroSection.vue` (or other landingpage components) out of the subfolder.
- Changing `index.vue` to reference `<LandingpageHeroSection />` directly.
- New components or new files.
- Nuxt config unrelated sections (CSS, modules, runtimeConfig, etc.).

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never run `prisma format` |

---

## 4. Approach

Approach A from brainstorming: add `~/components/landingpage` as a second `dirs` entry. Nuxt 4 deduplicates components across multiple `dirs` entries by their relative path; `HeroSection.vue` in `~/components/landingpage/HeroSection.vue` becomes auto-importable as `HeroSection`. The pre-existing `LandingpageHeroSection` export remains valid (it points to the same file via the `~/components` entry). There is no naming conflict.

The implementer:

1. Confirms there is no `HeroSection.vue` at `~/components/HeroSection.vue` (root of components) — the brief Step 2 covers this.
2. Modifies `nuxt.config.ts` `components.dirs` from `['~/components']` to `['~/components', '~/components/landingpage']`.
3. Runs `pnpm build` and confirms exit 0.
4. Reads `apps/web/.nuxt/components.d.ts` and confirms `export const HeroSection: ...` (without `Landingpage` prefix) is registered.

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `apps/web/nuxt.config.ts` | Modify (1-line change in `components.dirs` array) | Register `~/components/landingpage` for auto-import without prefix |

No new files.

---

## 6. Task Detail

### 6.1 Verify no name collision

Run:
```
ls apps/web/app/components/HeroSection.vue 2>&1 || echo "absent (good)"
```

Expected: `absent (good)`. If present, the `<HeroSection />` already resolves via the root `~/components` entry and this fix is unnecessary. If absent, the implementer proceeds.

### 6.2 Modify `nuxt.config.ts`

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

### 6.3 Verify

| Check | Command | Expected |
|---|---|---|
| Build | `cd apps/web && pnpm build` | exit 0 |
| Auto-import registered without prefix | `grep "^export const HeroSection:\|^export const HeroSection \|^export const HeroSection," apps/web/.nuxt/components.d.ts` | match |
| No regression in theme tests | `cd apps/web && pnpm vitest run app/theme/__tests__/copy.test.ts` | exit 0 |

### 6.4 Report

Append to `/home/misbahul45/.superpowers/sdd/2026-10-01-autoimport-fix-plan/task-1-report.md` (after dispatch):

```
Files touched:
- apps/web/nuxt.config.ts (modified; added '~/components/landingpage' to components.dirs)

Verification:
- pnpm build → exit 0
- grep HeroSection in apps/web/.nuxt/components.d.ts → match
- copy-guard test → exit 0 (no regression)

Concerns (if any).
```

Do not run `git add`/`commit`/`push`. Do not print values from `.env`. Do not write code comments.

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| `HeroSection.vue` exists at `~/components/HeroSection.vue` (root) AND `~/components/landingpage/HeroSection.vue` (subfolder) → name collision | High | Step 1 confirms absence before editing. If both exist, do not add `~/components/landingpage`; instead rename one of them or move one | Remove the new `dirs` entry |
| Nuxt's component path resolution differs from documented behavior | Low | Build green is the source of truth; if build fails, read the Nuxt error | Revert the `dirs` change to `['~/components']` |
| Other components in `landingpage/` (`CarrouselHome`, `FeatureSection`) similarly need auto-import — fix is global | Low | The same `dirs` addition makes them all available. No follow-up needed | n/a |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `bash` | ls, grep, pnpm build, pnpm vitest |
| `read`/`edit` | Source code changes |

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
  → executing-plans
  → final report
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-autoimport-fix-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-autoimport-fix-plan.md`.
3. Executed fix:
   - `apps/web/nuxt.config.ts` `components.dirs` includes `~/components/landingpage`
   - `pnpm build` exits 0
   - `HeroSection` registered in `apps/web/.nuxt/components.d.ts` without prefix
4. Final report.

---

## 10. Completion Condition

- Spec written and approved.
- Implementation plan written and approved.
- `apps/web/nuxt.config.ts` `components.dirs` contains `~/components` and `~/components/landingpage`.
- `pnpm build` exits 0.
- `apps/web/.nuxt/components.d.ts` exports `HeroSection` (without `Landingpage` prefix).
- Existing `pnpm vitest` runs remain green.
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.

---

## 11. Cross-references

- `apps/web/nuxt.config.ts` (file to modify).
- `apps/web/.nuxt/components.d.ts` (verification target).
- `apps/web/app/pages/index.vue` (consumer that previously failed to resolve).
- `apps/web/app/components/landingpage/HeroSection.vue` (the component now auto-importable).
- Track B-03 plan: `docs/superpowers/plans/2026-10-01-track-b03-plan.md` (the original plan whose Step 8 Playwright was deferred on this issue).
- `AGENTS.md` (rules).