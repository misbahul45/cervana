# Dynamic Theme Audit — Database to Component

> **Status**: `stable` · **Owner**: `web-lead` · **Last reviewed**: `2026-10-09`
>
> Traces a theme from the `Theme` table to a rendered component and states which links exist.

---

## Scope

The `Theme` data model and lifecycle in the api, the theme resolver and composables in the web, SSR behavior, accessibility handling, and which inputs (user preference, observed preference, level, topic, activity, gamification state, layout, motion) can change a theme. A `Theme` table is not evidence of a dynamic UI; each link is checked separately.

## Findings

### Path trace

| Link | Status | Source | Evidence |
|---|---|---|---|
| Database: `Theme`, `ThemeIcon`, node relations | `IMPLEMENTED` | `services/api/prisma/schema.prisma:841-885`; migration `20260930130000_theme_foundation` | fields: 4 colors, `tokens`, `atmosphere`, `variants`, `provenance`, `status`, `scope`, `tenantId`, `isDefault`, `version`; `Topic`, `SubTopic`, `Lesson`, `Step` each reference a theme. No relation to `User` |
| Lifecycle | `IMPLEMENTED` | `services/api/src/v1/gamify/themes/theme-state.ts:1-35` | DRAFT → REVIEW → PUBLISHED ⇄ SUSPENDED → ARCHIVED; delete only from DRAFT and unreferenced; intent routes `submit-review`, `publish`, `suspend`, `archive`, `set-default` |
| API surface | `IMPLEMENTED` | 15 routes in `ThemesController`; `GET /themes/default` is `@Public` | theme validator and asset policy in `theme-validator.ts`, `theme-asset-policy.ts` (contents not read) |
| Palette generator | `IMPLEMENTED` | `services/api/src/v1/gamify/themes/theme-proposer.service.ts:48-100`, `POST /themes/propose` | deterministic HSL arithmetic from mood and intensity; produces 14 light and 14 dark tokens plus atmosphere and variants; no LLM |
| API → SSR (default theme) | `UNWIRED` | `apps/web/server/utils/theme.ts:76` `getDefaultTheme` (800 ms timeout, 60 s fresh / 300 s stale cache, bundled fallback) | no caller anywhere in `apps/web`; `server/` contains only `utils/` |
| API → SSR (per curriculum node) | `PARTIAL` | `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue:16-18,55-60,101` | `useAsyncData` loads the sub-topic including `theme`; two colors become `--rc-page-primary` and `--rc-page-secondary` on the page root. One page only; tokens, variants and atmosphere are ignored |
| Resolver | `UNWIRED` | `apps/web/app/theme/resolve.ts:58-110`, `shell.ts:18-44`, `composables/useResolvedTheme.ts:17-61` | pure and unit-tested; `useResolvedTheme` and `useThemeCssVars` have no caller |
| Shell | `PARTIAL` | `apps/web/app/app.vue:10`, `components/theme/ThemeShell.vue:1-26` | rendered with no `step`, `lesson`, `subTopic`, `topic` or `variant` props, so `shellBindings` always returns the default branch; it passes `reducedMotion: false` (`ThemeShell.vue:20`) |
| CSS tokens | `IMPLEMENTED` (static) | `apps/web/app/assets/css/main.css:44-121`: `--rc-bg`, `--rc-surface`, `--rc-fg`, `--rc-primary`, … for light and dark, mapped to `--ui-*` | tokens do not change per learner |
| Component use | `PARTIAL` | components read `var(--rc-*)`; some retain hex fallbacks (`var(--rc-fg-muted, #6b7280)` in `MasteryProgressBar.vue`) | |

SSR evidence: the served HTML for `/` contains `<html lang="id">`, `class="app-wrapper"`, `data-rc-theme="reducera-ocean"`, `data-rc-variant="LEARN"`, `data-rc-motion="on"`. The page renders correctly with the API unreachable because it uses static CSS and the bundled `reducera-ocean.theme.json`. The color scheme comes from a cookie (`nuxt.config.ts:105-111`, key `rc-color-mode`).

### Resolution order

| Required layer (highest priority first) | Present | Evidence |
|---|---|---|
| Accessibility overrides | `MISSING` | `prefers-contrast` and `forced-colors`: 0 files; `prefers-reduced-motion`: 8 component files, not connected to the resolver |
| User explicit theme | `MISSING` | no model, route or store |
| Experience profile theme | `MISSING` | no `ExperienceProfile` in code or planning docs |
| Topic / lesson / step theme | `PARTIAL` | resolver order is `[step, lesson, subTopic, topic]` and returns the first non-null entry rather than merging (`resolve.ts:59-61`); live only for sub-topic colors on one page |
| Level variant | `MISSING` | |
| Activity variant | `PARTIAL` | `ThemeVariantKey = 'LEARN' \| 'PRACTICE' \| 'CHALLENGE' \| 'EXAM'` (`theme/types.ts:1`); `REVIEW` and `CREATOR` absent; no component passes a variant |
| Default theme | `IMPLEMENTED` | `theme/default-theme.ts`, bundled JSON, static CSS |

### Token coverage

Defined: 14 color tokens (`bg`, `surface`, `fg`, `muted`, `border`, `borderStrong`, `primary`, `primaryFg`, `secondary`, `secondaryFg`, `accent`, `focus`, `foam`, `sand`) and an atmosphere block (particles, motion intensity, lighting, waves, caustics). Not defined in the type: typography, spacing, radius, shadow, density, component variants, icon set choice. `ThemeIcon` and `bg_image`/`planet_image` fields exist in the database; their rendering was not traced.

### Input capability

| Input | Can change the rendered theme today |
|---|---|
| User preference (declared) | no |
| Observed preference | no |
| Level / mastery | no |
| Topic / sub-topic | yes: two colors, one page |
| Lesson / step | no (props never passed) |
| Activity (practice, challenge, exam) | no |
| Gamification state | no |
| Layout preference | no |
| Motion preference | no; the OS setting affects component CSS, not the theme |

### H-009

**Dynamic theming is not connected.** Evidence in one place: `app.vue:10` renders `ThemeShell` with no props; `getDefaultTheme` (`server/utils/theme.ts:76`) has no caller; `useResolvedTheme` and `useThemeCssVars` have no caller; `reducedMotion` is fixed to `false` (`ThemeShell.vue:20`). The only live API-to-CSS path is the sub-topic page. The tested resolver, the bundled default and the API lifecycle are sound parts without an integration layer. Consequence for the target: the experience compiler can reuse the token set, the variant keys, the lifecycle and the deterministic proposer, but the user, accessibility and level layers, the typed non-color tokens and the SSR delivery path are all new.

## Evidence citations

- `services/api/prisma/schema.prisma:841-885`; `services/api/src/v1/gamify/themes/{theme-state,theme-proposer.service}.ts`
- `apps/web/app/{app.vue:10,theme/*,composables/useResolvedTheme.ts,components/theme/ThemeShell.vue,assets/css/main.css:44-121}`
- `apps/web/server/utils/theme.ts:56,76`; `apps/web/nuxt.config.ts:105-111`
- `apps/web/app/pages/my-learning/sub-topics/[id]/index.vue:16-18,55-60,101`
- Live check: `curl http://localhost/` attributes listed above (2026-10-09)
- Tests: web `theme.spec` (19), `shell.spec` (4), `palette-doc.spec` (25), `copy.test` (2); api `theme-normalize.spec`

## Verdict

The platform has a themed-content model and a static, accessible-by-default look, but not a dynamic one. The database-to-CSS path works for exactly one page and two colors. The resolver, the SSR default fetch and the composables are tested and unused. No learner, accessibility, level or activity input changes a theme.
