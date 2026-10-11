# Dynamic UI Audit — Thirteen Dimensions

> **Status**: `stable` · **Owner**: `web-lead` · **Last reviewed**: `2026-10-09`
>
> For each dimension the target requires to adapt per learner, whether the database, API, AI and web can express it, and whether it runs.

---

## Scope

Theme, colors, typography, layout, density, navigation, motion, illustration, content presentation, microlearning duration, difficulty, hint behavior, chat strategy and gamification presentation. For each: database, API, AI, web, runtime, fallback, validation, test. Theme specifics are in [dynamic-theme-audit.md](./dynamic-theme-audit.md).

## Findings

### Capability matrix

`Y` = exists and is used by a running path; `p` = exists in part or is not reached; `-` = absent.

| Dimension | Database | API | AI | Web | Runtime per learner | Fallback | Validation | Test | Status |
|---|---|---|---|---|---|---|---|---|---|
| Theme (selection) | p `Theme` has no user link | p lifecycle routes | - | p one page reads a node theme | no | Y bundled default | Y api validator, web normalize | Y web 4 + 19, api spec | `PARTIAL` |
| Colors | Y 14 tokens in `tokens` JSON | Y | - | Y static CSS; p page colors | no | Y | Y | Y | `PARTIAL` |
| Typography | - | - | - | static fonts (`public/fonts`: Ubuntu, Exo 2, Orbitron, Roboto Mono; Ubuntu preloaded in `nuxt.config.ts:36`) | no | n/a | - | - | `MISSING` |
| Layout | - | - | - | 8 route-bound layouts (`app/layouts/`), chosen by `route.meta.layout` | no | Y | - | - | `MISSING` |
| Density | - | - | - | p `components/layout/ThemeShell.vue:3-10` has `density` (`compact`, `regular`, `expanded`) and shell CSS variables; no `<ThemeShell density=…>` caller found | no | Y default `regular` | - | - | `SCAFFOLDED` |
| Navigation | - | - | - | static `Header`, layouts | no | Y | - | - | `MISSING` |
| Motion | p `atmosphere.motion` in theme JSON | Y stored | - | p resolver enforces a reduced-motion budget; `ThemeShell` fixes `reducedMotion: false`; 8 components honor `prefers-reduced-motion` in their CSS | no | Y | p | Y resolver tests | `PARTIAL` |
| Illustration | p `bg_image`, `planet_image`, `ThemeIcon` | p asset policy | - | static SVGs in `public/pictures`; rendering of theme images not traced | no | Y | p asset policy | - | `UNVERIFIED` |
| Content presentation (document, cards, dashboard, focus) | - | - | - | one presentation per page | no | n/a | - | - | `MISSING` |
| Microlearning duration, chunk size, question count | - | - | prompt fixes 300–700 words and 3–5 exercises (`content_pipeline.py:339-361`) | - | no | n/a | - | - | `MISSING` |
| Difficulty | p `AdaptivePolicy` rows; `Question` has no difficulty column (the only `difficulty` fields are `InteractionEvaluation.difficultyAlign` and `ClassProduct`) | p `difficultyTarget` from `POST /tutor/message` | - (not passed to generation) | - | no | n/a | p invariants (`difficultyInZone…`) | Y api specs | `PARTIAL` |
| Hint behavior | - | p `hintLevel`, `scaffoldLevel`; quiz grading marks any answer with `hintUsed` incorrect with 0 points (`quiz-evaluation.service.ts:25-33`) | - | - | no | n/a | - | Y | `PARTIAL` |
| Chat strategy | - | p strategy chosen by the api tutor | fixed prompt, strategy not consumed | `Chatbot.vue` renders messages | no | Y | - | p | `PARTIAL` |
| Gamification presentation | - | - | canned phrases in an unreachable package | components exist (`RewardToast`, `BadgeToast`, `LevelBadge`, `StreakIndicator`); no intensity setting | no | Y | - | none | `MISSING` (dynamic) |

Result: 0 of 13 dimensions adapts per learner at runtime. Seven have some stored or computed value (`Theme`, colors, motion, illustration, difficulty, hint, chat strategy), and each stops before reaching the screen.

### Experience layer

| Target component | Status | Evidence |
|---|---|---|
| `ExperienceProfile` (typed, versioned) | `MISSING` | no identifier `ExperienceProfile`, `ExperienceSnapshot`, `ExperienceProposal`, `ExperienceCompiler`, `useExperience`, `MicrolearningPolicy` in code or in `docs/strategy/` |
| Natural-language customization → typed proposal → validation → preference update | `MISSING` | no route, agent or store; the deterministic palette generator (`theme-proposer.service.ts`) is the nearest typed, bounded producer |
| `useExperience()`, `useLayout()`, `useLearningSpec()`, `useGamificationSpec()`, `useChatSpec()` | `MISSING` | `apps/web/app/composables/` holds `useIdempotencyKey`, `usePurchase`, `useResolvedTheme`, `useThemeCssVars` |
| Experience snapshot cache (ETag, `Cache-Control`, versioned assets) | `MISSING` | the only cache is `server/utils/theme.ts` (in-memory, default theme) |
| Fallback to last valid snapshot, then defaults | `PARTIAL` | defaults exist; no snapshot concept |
| Accessibility priority (forced colors, contrast, reduced motion, keyboard, semantics) | `PARTIAL` | `prefers-contrast` 0 files, `forced-colors` 0 files, `prefers-reduced-motion` 8 files; `<html lang="id">` present; skip link component exists (`SkipLink` aliased in `nuxt.config.ts:88`) |

### M-009

**Web verification gap.** The 135 web tests cover pure modules (`theme/`, `lib/`): no component is mounted, `server/utils/theme.ts` is untested, and no browser run was performed in this audit (the Playwright matrix required by `AGENTS.md` for web changes is absent from the repository's test suite; `docs/01-audit/e2e-playwright-verification.md` is a prior report and was not re-run). Responsive, contrast and focus claims in earlier documents are therefore `UNVERIFIED` here.

## Evidence citations

- `apps/web/app/{layouts,components/layout/ThemeShell.vue:3-10,components/theme/ThemeShell.vue:20,composables,theme}`; `apps/web/nuxt.config.ts:36,88,105-111`
- `apps/web/app/components/{gamification,learn,ai}/`; `apps/web/app/components/my-learning/Chatbot.vue`
- `services/api/src/v1/tutor/tutor.service.ts:105-134`; `services/api/src/v1/quiz/services/quiz-evaluation.service.ts:25-33`
- `services/ai-api/v1/learning/content_pipeline.py:339-361`
- Grep over `services/`, `apps/`, `docs/strategy/` for the experience identifiers: no code hits
- Live HTML for `/` (2026-10-09); vitest: 13 files, 135 tests

## Verdict

The interface is statically themed and responsive in structure, but nothing in the system adapts to a learner. There is no experience profile, compiler, proposal path, per-user preference store or SSR delivery path for them. What can be reused: the 14-token set and variant keys, the node-level theme lifecycle, the deterministic palette generator, the api's tutoring-strategy output and the `density` shell. Everything that makes the experience a function of learner state is new work.
