# Track TU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adapted for this repo:** "Commit" steps in the standard template are replaced by "Report" steps. The agent never runs `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, or `git stash drop`. Staging and committing are owner responsibilities.

**Goal:** Replace the legacy `<Sunset />` atmosphere in three consumer pages with the existing `<ThemeShell>` wrapper, and add `BrandLogo.vue` (inline SVG mark + "ReduCera" wordmark).

**Architecture:** Pure refactor + new component. The legacy `<Sunset />` is removed in favour of the existing `<ThemeShell>` wrapper that already provides theme-token injection and atmosphere CSS variables. The new `BrandLogo.vue` is a single-file Vue SFC with an inline SVG (no asset file).

**Tech Stack:** Vue 3 SFC, Nuxt 4, Tailwind CSS, existing `apps/web/app/components/theme/ThemeShell.vue` (no changes).

## Global Constraints

These constraints apply to every task. Sources: `AGENTS.md`, the V1 execution plan §2 / §7.4 / §7.5.

- **No comments in code, Dockerfiles, compose, nginx, or config files.** Variable names and function names carry the documentation.
- **Never run `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, or `git stash`.** Stage and commit are owner responsibilities.
- **No secrets in tracked files, docs, or logs.** Never print values from `.env`.
- **Never run `prisma format`.**
- **Decorative CSS/SVG `< 6 KB` gzip.** `BrandLogo` is a logo not atmosphere; the 4 KB atmosphere cap does not apply, but it should still be compact.
- **Wordmark uses bundled Ubuntu font** (already preloaded in `nuxt.config.ts:35-36`).
- **Status values:** `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never `DONE` for work not run.
- **Code, identifiers and docs in English.** User-facing web copy in Indonesian.
- **Skip Playwright matrix** for this plan: the refactor + new component are validated via grep + build, and Playwright is gated on R-03 (missing secrets).

---

## File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `apps/web/app/components/brand/BrandLogo.vue` | Create | Brand mark + wordmark SVG component |
| `apps/web/app/components/my-learning/MainSubTopics.vue` | Modify | Drop `<Sunset />`; wrap with `<ThemeShell>` |
| `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue` | Modify | Same |
| `apps/web/app/pages/my-learning/lessons/[id]/index.vue` | Modify | Same |

No new files outside the four above.

---

### Task 1: BrandLogo component

**Files:**
- Create: `apps/web/app/components/brand/BrandLogo.vue`

**Interfaces:**
- Consumes: existing CSS variables `--rc-primary`, `--rc-secondary`, `--rc-fg`, `--rc-surface` from `apps/web/app/assets/css/main.css`. Bundled `Ubuntu` font (preloaded).
- Produces: Vue SFC `BrandLogo` default export, props `{ size?: 'sm' | 'md' | 'lg' }` (default `'md'`).

- [ ] **Step 1: Create `BrandLogo.vue`**

Create `apps/web/app/components/brand/BrandLogo.vue` with the following content (no comments per AGENTS.md):

```vue
<template>
  <NuxtLink to="/" :class="containerClass" :aria-label="'ReduCera – Ekosistem Belajar Akuntansi'">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :class="markClass"
      :viewBox="'0 0 32 32'"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="brand-pearl" cx="0.4" cy="0.4" r="0.6">
          <stop offset="0" :stop-color="'var(--rc-surface)'" />
          <stop offset="0.6" :stop-color="'var(--rc-primary)'" stop-opacity="0.8" />
          <stop offset="1" :stop-color="'var(--rc-secondary)'" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#brand-pearl)" stroke="currentColor" stroke-width="1" />
      <circle cx="11" cy="11" r="4" :fill="'var(--rc-fg)'" fill-opacity="0.3" />
    </svg>
    <div :class="textClass">
      <p class="font-bold leading-none">ReduCera</p>
      <p :class="taglineClass">Ekosistem Belajar Akuntansi</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components';

const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'md',
});

const containerClass = computed(() => ({
  sm: 'flex items-center gap-2',
  md: 'flex items-center gap-3',
  lg: 'flex items-center gap-4',
}[props.size]));

const markClass = computed(() => ({
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}[props.size]));

const textClass = computed(() => ({
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}[props.size));

const taglineClass = computed(() => ({
  sm: 'text-[10px] font-medium opacity-70',
  md: 'text-xs font-medium opacity-70',
  lg: 'text-sm font-medium opacity-70',
}[props.size));
</script>
```

Note: `computed` is auto-imported by Nuxt 4. If `computed` is not auto-imported in this project's Nuxt config, add `import { computed } from 'vue'` at the top of `<script setup>`. The implementer should verify by running `pnpm build` and checking for errors.

- [ ] **Step 2: Verify file exists and is compact**

Run: `ls apps/web/app/components/brand/BrandLogo.vue && wc -c apps/web/app/components/brand/BrandLogo.vue`
Expected: file exists; byte count < 4096 (no budget constraint applies, but compact).

- [ ] **Step 3: Build the web app**

Run: `cd apps/web && pnpm build`
Expected: exit 0.

- [ ] **Step 4: Run the copy-guard test**

Run: `cd apps/web && pnpm vitest run app/theme/__tests__/copy.test.ts`
Expected: exit 0 (no banned terms; "Ekosistem Belajar Akuntansi" is approved copy).

---

### Task 2: Refactor `MainSubTopics.vue`

**Files:**
- Modify: `apps/web/app/components/my-learning/MainSubTopics.vue`

**Interfaces:**
- Consumes: existing `ThemeShell` component (`apps/web/app/components/theme/ThemeShell.vue`); page-level props if defined on the component (the implementer reads the file to determine).
- Produces: modified component that no longer references `<Sunset />`.

- [ ] **Step 1: Open and inspect the file**

Run: `grep -n "Sunset\|ThemeShell\|^import" apps/web/app/components/my-learning/MainSubTopics.vue`

Note lines that import `Sunset` and where `<Sunset />` is rendered. Also note any `defineProps<...>()` block — these are the props the component accepts and the ones that can be passed to `<ThemeShell>`.

- [ ] **Step 2: Drop the `Sunset` import and element**

Edit `apps/web/app/components/my-learning/MainSubTopics.vue`:

1. Remove `import Sunset from '~/components/ui/Sunset.vue'` (or similar import line for `Sunset`).
2. Remove the `<Sunset />` element from the template.
3. Wrap the page-content root with `<ThemeShell>` (passing only the props the component already has, e.g. `:sub-topic="..." :variant="..."`):
```vue
<ThemeShell :sub-topic="subTopicRef" :variant="'LEARN'">
  <!-- existing page content here -->
</ThemeShell>
```
   Adapt the binding to whatever the component's existing `defineProps` declares; do not introduce new props.

- [ ] **Step 3: Verify Sunset is gone**

Run: `grep -rn "Sunset" apps/web/app/components/my-learning/MainSubTopics.vue`
Expected: empty.

- [ ] **Step 4: Build and copy-guard**

Run: `cd apps/web && pnpm build && pnpm vitest run app/theme/__tests__/copy.test.ts`
Expected: both exit 0.

---

### Task 3: Refactor `sub-topics/[id]/index.vue`

**Files:**
- Modify: `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue`

- [ ] **Step 1: Inspect the file**

Run: `grep -n "Sunset\|ThemeShell\|^import" apps/web/app/pages/my-learning/sub-topics/[id]/index.vue`

- [ ] **Step 2: Drop `Sunset` import and element, wrap with `<ThemeShell>`**

Same pattern as Task 2 Step 2. The page has access to route data (typically a `topicId` or similar); pass what the page already loads (e.g., `:sub-topic="..." :topic="..." :variant="..."`) to `<ThemeShell>`. If the page loads a single sub-topic by id and exposes it as a ref, pass that ref. Do not introduce new props.

- [ ] **Step 3: Verify**

```
grep -rn "Sunset" apps/web/app/pages/my-learning/sub-topics/[id]/index.vue
cd apps/web && pnpm build && pnpm vitest run app/theme/__tests__/copy.test.ts
```

Expected: grep empty; both exit 0.

---

### Task 4: Refactor `lessons/[id]/index.vue`

**Files:**
- Modify: `apps/web/app/pages/my-learning/lessons/[id]/index.vue`

- [ ] **Step 1: Inspect**

Run: `grep -n "Sunset\|ThemeShell\|^import" apps/web/app/pages/my-learning/lessons/[id]/index.vue`

- [ ] **Step 2: Drop `Sunset` import and element, wrap with `<ThemeShell>`**

Same pattern. The page has access to lesson data; pass `:lesson="..."` and `:variant="..."` if those props exist on the page.

- [ ] **Step 3: Verify**

```
grep -rn "Sunset" apps/web/app/pages/my-learning/lessons/[id]/index.vue
cd apps/web && pnpm build && pnpm vitest run app/theme/__tests__/copy.test.ts
```

Expected: grep empty; both exit 0.

---

### Task 5: Cross-page Sunset sweep + final report

- [ ] **Step 1: Confirm no Sunset imports anywhere under TU scope**

Run: `grep -rn "import.*Sunset\|from.*Sunset" apps/web/app/components/my-learning/ apps/web/app/pages/my-learning/`
Expected: empty.

If matches appear in `MainSubTopics.vue`, `sub-topics/[id]/index.vue`, or `lessons/[id]/index.vue`, revisit Task 2/3/4 for that file. Other consumers (e.g., `(auth)/login.vue`, layouts/) are outside this plan's scope.

- [ ] **Step 2: Confirm no `<Sunset />` elements in TU scope**

Run: `grep -rn "<Sunset\|UiSunset" apps/web/app/components/my-learning/ apps/web/app/pages/my-learning/`
Expected: empty.

- [ ] **Step 3: Confirm `BrandLogo` exists**

Run: `ls apps/web/app/components/brand/BrandLogo.vue && wc -c apps/web/app/components/brand/BrandLogo.vue`
Expected: file exists.

- [ ] **Step 4: Final build + report**

Run: `cd apps/web && pnpm build`
Expected: exit 0.

Print to the implementer's report file:
```
Files touched:
- apps/web/app/components/brand/BrandLogo.vue (created, <N> bytes)
- apps/web/app/components/my-learning/MainSubTopics.vue (modified)
- apps/web/app/pages/my-learning/sub-topics/[id]/index.vue (modified)
- apps/web/app/pages/my-learning/lessons/[id]/index.vue (modified)

Verification:
- grep -rn "Sunset" apps/web/app/components/my-learning/ apps/web/app/pages/my-learning/ → empty
- grep -rn "<Sunset\|UiSunset" same paths → empty
- pnpm build → exit 0
- copy-guard test → exit 0

Concerns (if any).
```

Do not run `git add`/`commit`/`push`. Do not print values from `.env`. Do not write code comments.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task that implements it |
|---|---|
| TU-04 BrandLogo.vue exists with size prop | Task 1 §Steps 1-2 |
| TU-05a MainSubTopics.vue drops Sunset, wraps with ThemeShell | Task 2 §Steps 1-4 |
| TU-05b sub-topics/[id]/index.vue drops Sunset, wraps with ThemeShell | Task 3 §Steps 1-3 |
| TU-05c lessons/[id]/index.vue drops Sunset, wraps with ThemeShell | Task 4 §Steps 1-3 |
| pnpm build green | Tasks 1-5 each verify with `pnpm build` |
| copy guard green | Tasks 1-5 each run copy-guard |
| Final cross-page sweep empty | Task 5 §Steps 1-2 |
| Final report | Task 5 §Step 4 |

No spec requirement is unassigned.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", "fill in details", "similar to Task 1" patterns. BrandLogo.vue code block is verbatim. Refactor steps give an exact template pattern (`<ThemeShell ...>` wrapping).

### 3. Type consistency

- `BrandLogo` props: `{ size?: 'sm' | 'md' | 'lg' }` (defined in Step 1, used in containerClass / markClass / textClass / taglineClass).
- `ThemeShell` props: `topic` / `lesson` / `subTopic` / `step` / `variant` (pre-existing, no changes). Each refactor task passes only the subset the consumer page already has.
- `Sunset` is the legacy component name (no type clash with `BrandLogo`).

No drift.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-01-track-tu-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?