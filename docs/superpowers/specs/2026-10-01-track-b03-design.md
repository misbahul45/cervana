# Track B-03 — OceanHero SVG

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.5 B-03.
> Scopes only B-03 (OceanHero.vue inline SVG). Other B tasks (B-01, B-02, B-04, B-05) are already complete.

---

## 1. Context

Track B is the copy and branding track. Of the five B tasks:

- B-01 site title/meta copy to university voice: ✅ complete (`nuxt.config.ts:8-32`).
- B-02 hero/landing/topics copy rewrite (no SMK, no SKKNI, no siswa, etc.): ✅ complete (`apps/web/app/pages/index.vue`, `apps/web/app/pages/learn/topics/*.vue`).
- B-03 replace astronaut illustration with ocean SVG hero: **incomplete**.
- B-04 banned-terms copy guard test: ✅ complete (`apps/web/app/theme/__tests__/copy.test.ts`).
- B-05 SEO preview image: ✅ complete (covered in Track S).

`apps/web/app/components/landingpage/HeroSection.vue:34` still has:

```html
<NuxtImg
  src="pictures/home/hero.svg"
  alt="astronaut illustration"
  class="w-full h-auto relative z-10 rotate-16"
/>
```

This spec closes B-03.

---

## 2. Goal

Replace the astronaut illustration with an inline ocean-themed SVG hero (`< 4 KB`) that fits the ReduCera ocean theme and respects `prefers-reduced-motion`.

---

## 3. Scope

### 3.1 In scope

- Create `apps/web/app/components/landingpage/OceanHero.vue` — inline SVG component, ≤ 4 KB.
- Modify `apps/web/app/components/landingpage/HeroSection.vue` to replace the `<NuxtImg>` block with `<OceanHero />`.
- Verify: no `astro*` strings remain in `apps/web/app/components/landingpage/`; `pictures/home/hero.svg` becomes unused (but the file is not deleted in this task — it can stay for now, owner may stage a separate cleanup commit if desired).
- Web verification (Playwright MCP): hero renders at 375x812 and 1280x800, light and dark; `prefers-reduced-motion: reduce` disables animation; no console errors.

### 3.2 Out of scope

- B-01, B-02, B-04, B-05 (already complete).
- Removing `pictures/home/hero.svg` from disk (file may stay).
- Track TU (theme shell, BrandLogo), Track S (SSR fixes), Track TT (theme layer).
- Theme atmosphere bubbles/waves CSS layer — Track TU.
- Any change to the floating "Otomasi" / "Gamified" / "Adaptif" / "Penguasaan" keyword chips (Track TU handles styling tokens for these).

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| execution plan §7.4 | Decorative CSS/SVG `< 6 KB` gzip; hero at `< 4 KB` |
| execution plan §7.4 | Only `transform` and `opacity` animate; respect `prefers-reduced-motion: reduce` |
| execution plan §7.4 | No video, no canvas, no image asset for the default theme |
| `AGENTS.md` "Web verification" | Playwright MCP matrix at 375x812, 768x1024, 1280x800; light + dark; `reducedMotion: reduce` once; zero console errors; contrast ≥ 4.5:1 |

---

## 4. Approach

Pure inline SVG using Nuxt UI semantic color tokens (`currentColor`, `var(--rc-primary)`, `var(--rc-secondary)`, `var(--rc-accent)`). Animate via `<animate>` SVG primitives or CSS `@keyframes` (no JS). Gate animation behind `@media (prefers-reduced-motion: no-preference)`.

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `apps/web/app/components/landingpage/OceanHero.vue` | Create | Inline ocean SVG hero (≤ 4 KB) |
| `apps/web/app/components/landingpage/HeroSection.vue` | Modify | Replace `<NuxtImg src="pictures/home/hero.svg">` with `<OceanHero />` |

No new files. No SVG asset (no `<img>` reference). No theme token changes.

---

## 6. Task Detail

### 6.1 Create `OceanHero.vue`

File: `apps/web/app/components/landingpage/OceanHero.vue`

The component must be a Vue SFC (`<template>` + `<script setup lang="ts">`) containing inline SVG. No `<style>` block (use Tailwind classes on SVG; if `prefers-reduced-motion` handling is needed, use Tailwind's `motion-safe:` / `motion-reduce:` variants).

Layout requirements:
- `<svg viewBox="0 0 400 400">` (square).
- Layers (back to front): depth gradient (linear), caustic light (radial), bubbles (4-6 circles), central orb (the "pearl" replacing the astronaut, made from `<radialGradient>` + `<circle>`), two-layer wave strip at the bottom.
- Animations: `<animate>` on `<circle>` elements (rises from bottom); CSS keyframes on orb opacity (`motion-safe` only).
- Colour: use `var(--rc-primary)`, `var(--rc-secondary)`, `var(--rc-accent)` via `fill` attributes or CSS classes. Do not hardcode hex outside the window.

Size budget: ≤ 4096 bytes uncompressed.

### 6.2 Modify `HeroSection.vue`

Open `apps/web/app/components/landingpage/HeroSection.vue`. Replace lines 33-37:

```vue
          <NuxtImg
            src="pictures/home/hero.svg"
            alt="astronaut illustration"
            class="w-full h-auto relative z-10 rotate-16"
          />
```

With:

```vue
          <OceanHero class="w-full h-auto relative z-10 motion-safe:animate-[float_6s_ease-in-out_infinite]" />
```

(The motion-safe utility class is illustrative; exact class depends on Tailwind configuration. The key requirement: animation runs only when `prefers-reduced-motion: no-preference`.)

Also import the component at the top of `<script setup lang="ts">`:

```ts
import OceanHero from '~/components/landingpage/OceanHero.vue'
```

### 6.3 Verify

| Check | Command | Expected |
|---|---|---|
| No astronaut reference in landingpage/ | `grep -rn "astro" apps/web/app/components/landingpage/` | empty |
| Component imports | `grep -n "OceanHero" apps/web/app/components/landingpage/HeroSection.vue` | matches |
| Web build | `cd apps/web && pnpm build` | exit 0; no hero-id decoration produces errors |
| Playwright hero renders | resize 375x812, dark, screenshot `.playwright-mcp/b03-hero-375-dark.png` | renders, zero console errors |
| Playwright hero light | light scheme, screenshot `.playwright-mcp/b03-hero-375-light.png` | renders, contrast OK |
| Playwright reduced motion | `reducedMotion: reduce`, screenshot `.playwright-mcp/b03-hero-375-dark-reduced.png` | animation paused |
| H-04 copy guard passes | `cd apps/web && pnpm vitest run app/theme/__tests__/copy.test.ts` | exit 0 |

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| OceanHero.vue exceeds 4 KB | Low | Author line numbers count the file size; bail if > 4 KB and trim decorations | Strip `<animate>` and bubbles, keep only orb + waves |
| `currentColor` doesn't propagate to SVG `fill` because `class` is consumed by Tailwind | Low | Use inline `style="fill: var(--rc-primary)"` or `fill` attribute with class wrapping `style` | Use explicit color variables in `<style scoped>` block — wait, no comments rule. Use Tailwind utility classes for `fill-*` |
| Animation runs in `reducedMotion: reduce` mode | Medium | Wrap animation in `motion-safe:` Tailwind variant | Test with `--reduced-motion` flag in Playwright |
| `pictures/home/hero.svg` still referenced from Nuxt's image optimiser (cache, manifest) | Low | No file deletion in this task; cache eventually clears | Owner runs `pnpm build` to refresh manifests |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `bash` | Verify, build, playwright via npm script |
| `read`/`edit`/`write` | Source code changes |
| `grep`/`glob` | Locate references |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces the implementation plan |
| `executing-plans` | Execute task (inline mode chosen) |
| `verification-before-completion` | Before claiming DONE |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review of this spec
  → writing-plans (produces plan doc)
  → user approval of plan
  → inline execution (executing-plans skill)
  → Playwright verification
  → final report
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-track-b03-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-b03-plan.md`.
3. Executed B-03: new `OceanHero.vue`, updated `HeroSection.vue`, build green, Playwright matrix green, copy guard green.
4. Final report listing changed files and verification outputs.

---

## 10. Completion Condition

- This spec written and approved.
- Implementation plan written and approved.
- `OceanHero.vue` exists, ≤ 4 KB, contains no `astro*` references.
- `HeroSection.vue` uses `<OceanHero />` and no longer references `pictures/home/hero.svg` or `astronaut`.
- `pnpm build` exits 0.
- Playwright matrix (375x812 light + dark, 1280x800, reduced motion once) renders the hero with zero console errors.
- Copy guard test passes.
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.

---

## 11. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.5 B-03 source of truth.
- §7.4 Atmosphere (CSS only) budgets for the SVG decoration.
- `apps/web/app/components/landingpage/HeroSection.vue` (current state).
- `apps/web/nuxt.config.ts` (CSS variables `--rc-*` available globally).
- `apps/web/app/theme/__tests__/copy.test.ts` (B-04 copy guard).