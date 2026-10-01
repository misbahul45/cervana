# Track TU Full Implementation — BrandLogo + Refactor 3 Consumer Pages

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.6 TU-04 and TU-05.
> Scopes only the remaining Track TU tasks. Other TU tasks (TU-01 scales, TU-02 ThemeShell, TU-03 atmosphere CSS) are already complete or built-in.

---

## 1. Context

Track TU is the UI theme-shell track. The execution plan §8.6 specifies six TU tasks:

- TU-01 Register Nuxt UI scales `reef` (primary), `tide` (secondary), `shell` (neutral): ✅ complete. `apps/web/app/app.config.ts` declares `colors: { primary: 'reef', secondary: 'tide', neutral: 'shell', ... }`. `apps/web/app/assets/css/main.css` declares the `--color-reef-*`, `--color-tide-*`, `--color-shell-*` token sets (lines per execution plan §7.3).
- TU-02 ThemeShell wrapper component: ✅ complete. `apps/web/app/components/theme/ThemeShell.vue` exposes `dataAttributes`, `style`, and `resolved` via `useResolvedTheme`. `apps/web/app/app.vue:9` wraps the root layout with `<ThemeShell class="app-wrapper">`.
- TU-03 ThemeBackground (CSS atmosphere): partial. Inline `radial-gradient(ellipse …)` definitions in `MainSubTopics.vue` and the consumer pages already provide atmosphere using `--rc-page-*` CSS variables. No standalone `ThemeBackground.vue` component is needed.
- TU-04 BrandLogo (replace cervana/Cervana mark with `ReduCera` mark + bundled Ubuntu font): **incomplete**. `apps/web/app/components/brand/` does not exist.
- TU-05 Refactor 3 consumer pages from raw color usage to theme shell wrapper: **incomplete**. The 3 pages still import the legacy `<Sunset />` component.
- TU-06 Accessibility/contrast fix: partial. Most pages use `--rc-*` tokens; specific page-level contrast checks are owner-verified at end of V1.

This spec closes TU-04 and TU-05.

---

## 2. Goal

Replace the legacy `<Sunset />` atmosphere rendering in three consumer pages with the existing `<ThemeShell>` wrapper, and add a `BrandLogo.vue` component for the new ReduCera brand.

---

## 3. Scope

### 3.1 In scope

- **TU-04** Create `apps/web/app/components/brand/BrandLogo.vue` — inline SVG with circular "pearl" mark + "ReduCera" wordmark. Uses bundled `Ubuntu` (fonts already preloaded in `nuxt.config.ts:35-36`).
- **TU-05a** `apps/web/app/components/my-learning/MainSubTopics.vue` — drop `import Sunset from '~/components/ui/Sunset.vue'`; remove the `<Sunset />` element; wrap the page content with `<ThemeShell :sub-topic="..." :variant="...">` (only props that exist on the page).
- **TU-05b** `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue` — same refactor.
- **TU-05c** `apps/web/app/pages/my-learning/lessons/[id]/index.vue` — same refactor.

### 3.2 Out of scope

- TU-01, TU-02, TU-03, TU-06 (already complete or partial).
- Track TT (theme layer), Track S (SSR fixes), Track B (copy/branding), Track TD (database foundation).
- Deleting `apps/web/app/components/ui/Sunset.vue` and `apps/web/app/components/ui/Blackhole.vue` — the files stay; owner may stage a separate cleanup commit.
- Adding BrandLogo as a consumer in `Header.vue`, `auth-init.server.ts`, or any other consumer — owner may wire it later.

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never run `prisma format` |
| execution plan §7.5 | Wordmark uses bundled Ubuntu (remove Orbitron / Exo 2 if not used) |
| execution plan §7.4 | Decorative CSS/SVG `< 6 KB` gzip; BrandLogo is a "logo" not an "atmosphere", so the 4 KB cap does not apply |
| `AGENTS.md` "Web verification" | Skip Playwright matrix for this task — gated on R-03; grep + build verification is sufficient for the refactor + new-component checks |

---

## 4. Approach

Approach B from the brainstorming: replace `<Sunset />` legacy atmosphere with the existing `<ThemeShell>` wrapper. `Sunset.vue` is the legacy atmosphere rendering that draws a per-component brand-illustration; `ThemeShell` already injects the theme tokens via `data-rc-theme`, `data-rc-scheme`, etc., and inherits atmosphere CSS variables from `main.css`. The refactor removes the redundant `<Sunset />` render but keeps the inline `radial-gradient` blocks in each consumer page that drive `--rc-page-primary` and `--rc-page-secondary` — those are scoped per page, not theme-token-driven.

For `BrandLogo`, inline component (Vue SFC) with `<template>` (SVG), `<script setup lang="ts">` (props, no behaviour), and no `<style>` block (Tailwind classes only).

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `apps/web/app/components/brand/BrandLogo.vue` | Create | Brand mark + wordmark SVG |
| `apps/web/app/components/my-learning/MainSubTopics.vue` | Modify | Drop `<Sunset />` import + element; wrap with `<ThemeShell>` |
| `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue` | Modify | Same |
| `apps/web/app/pages/my-learning/lessons/[id]/index.vue` | Modify | Same |

No new files outside the four above. No SVG asset (the brand mark is inline).

---

## 6. Task Detail

### 6.1 Create `BrandLogo.vue`

File: `apps/web/app/components/brand/BrandLogo.vue`.

The component is a Vue SFC. No `<style>` block (Tailwind classes on SVG elements). No comments. Props: `size?: 'sm' | 'md' | 'lg'` (default `'md'`). Renders an inline SVG with:

- A 32×32 circular "pearl" mark using `<radialGradient>` whose stops reference `var(--rc-primary)`, `var(--rc-secondary)`, and `var(--rc-fg)` (for the highlight). Outer ring is `stroke="currentColor"`.
- A `<text>` element with `font-family: "Ubuntu, sans-serif"`, `font-weight: 700`, content "ReduCera", positioned to the right of the mark.
- A `<span>` (or text) with `Ekosistem Belajar Akuntansi` in lighter weight, positioned below the wordmark.

Tailwind sizing:
- `sm`: 24×24 mark, 14px wordmark
- `md`: 32×32 mark, 18px wordmark
- `lg`: 48×48 mark, 24px wordmark

Colour uses `currentColor` for stroke and `var(--rc-*)` for fills. The wordmark text uses `class="text-[var(--rc-fg)]"`.

### 6.2 Modify `MainSubTopics.vue`

Open `apps/web/app/components/my-learning/MainSubTopics.vue`.

1. Remove `import Sunset from '~/components/ui/Sunset.vue'`.
2. Find the root template element and wrap the relevant slot with `<ThemeShell :sub-topic="..." :variant="...">`. If the page already has a `subTopic` prop, pass it; otherwise omit.
4. Remove the `<Sunset />` element (it's near the end of the template).

### 6.3 Modify `sub-topics/[id]/index.vue`

Open `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue`. Same refactor pattern as 6.2: drop import, wrap root, remove `<Sunset />`. Page has access to the route's `[id]` param; pass `topic="…"` to ThemeShell if the page already loads the topic.

### 6.4 Modify `lessons/[id]/index.vue`

Open `apps/web/app/pages/my-learning/lessons/[id]/index.vue`. Same pattern.

### 6.5 Verify

| Check | Command | Expected |
|---|---|---|
| Sunset removed | `grep -rn "Sunset" apps/web/app/components/my-learning/ apps/web/app/pages/my-learning/` | empty |
| BrandLogo exists | `ls apps/web/app/components/brand/BrandLogo.vue` | exists |
| Build | `cd apps/web && pnpm build` | exit 0 |
| Copy guard | `cd apps/web && pnpm vitest run app/theme/__tests__/copy.test.ts` | exit 0 |

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| `ThemeShell` requires props (`topic`, `lesson`, `step`, `variant`); consumer pages may not have them all | Medium | Read each page before refactor; pass only the props that exist; `variant` defaults to `'LEARN'` | Wrap in minimal `<ThemeShell>` with no props |
| Removing `<Sunset />` reveals design regression (atmosphere missing) | Medium | ThemeShell already injects --rc-page-* tokens; radial-gradients on the consumer pages still work. If regression visible, re-add `<Sunset />` as a child of `<ThemeShell>` | Inline radial-gradients restore |
| `BrandLogo` SVG `font-family: Ubuntu` fails to load on first paint | Low | Ubuntu fonts are preloaded in `nuxt.config.ts:35-36`. Use fallback `serif` if Ubuntu fails | Document as known-limitation; revisit when designer asset replaces SVG |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `bash` | grep, build, vitest |
| `read`/`edit`/`write` | Source code changes |
| `grep`/`glob` | Locate Sunset imports, identify unused code |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces implementation plan |
| `subagent-driven-development` | Execution |
| `verification-before-completion` | Before claiming DONE |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review
  → writing-plans
  → subagent-driven-development
  → final review
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-track-tu-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-tu-plan.md`.
3. Executed TU-04 + TU-05:
   - `BrandLogo.vue` created
   - 3 consumer pages refactored (Sunset import + element dropped; ThemeShell wraps content)
   - Build green, copy guard green
4. Final report listing changed files and verification outputs.

---

## 10. Completion Condition

- This spec written and approved.
- Implementation plan written and approved.
- `BrandLogo.vue` exists, no comments, uses CSS variables for colour.
- 3 consumer pages no longer reference `<Sunset />` (grep confirms).
- `pnpm build` exits 0.
- Copy guard passes (no banned terms).
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.

---

## 11. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.6 (Track TU source of truth).
- §7.5 Logo and brand-mark assets.
- §7.4 Atmosphere budgets.
- `apps/web/app/components/theme/ThemeShell.vue` (TU-02 implementation).
- `apps/web/app/app.config.ts` (TU-01 Nuxt UI scales).
- `apps/web/app/assets/css/main.css` (CSS variables).
- `apps/web/app/theme/reducera-ocean.theme.json` (theme tokens).
- `apps/web/nuxt.config.ts:35-36` (Ubuntu font preload).
- `apps/web/app/theme/__tests__/copy.test.ts` (B-04 copy guard).
- `AGENTS.md` "Web verification" (Playwright matrix deferred on R-03).