# ReduCera V1 — Execution Plan

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Ordered, verifiable task list for a lower-cost executor model. It takes ReduCera from the state verified on 2026-09-30 to V1, in the order database, then theme, then UI, with server-side rendering as a first-class requirement.

Section numbers such as "§37" refer to the ReduCera master prompt (accounting-first, immersive theme system, 219 sections). This plan complements [`phased-roadmap.md`](./phased-roadmap.md) (agent and learner-model roadmap) and [`../architecture/TARGET_STATE.md`](../architecture/TARGET_STATE.md) (commerce and tenancy phases). Where they disagree on the theme, UI or SSR, this plan wins; where they disagree on commerce, tenancy or agents, they win.

---

## 1. Objective

1. Make the business direction visible everywhere: **ReduCera is a university-focused, AI-powered Accounting learning ecosystem built around a circular learning economy and immersive learning atmospheres** (§215). The current product still presents itself as an SMK certification app.
2. Ship a default **ocean theme** ("nuansa laut") that the web always has, with or without the database, and make the UI visibly change (logo, hero, background, cards, both color schemes).
3. Deliver in this order: **DB → theme → UI**. The database holds the theme, a theme layer validates and resolves it, the UI only consumes resolved design tokens.
4. Everything renders on the server (SSR) with the theme already in the first HTML byte, no flash, no client waterfall, and no dependence on a slow API.
5. Keep the accounting learning core, the accounting domain and the theme system separate (§5): the theme changes presentation only.

### 1.1 Scope

| Area | Touched |
|---|---|
| Database | `services/api/prisma/schema.prisma`, one new migration, `seed.ts`, `seed-theme.ts`, `seed-data/` |
| API | `services/api/src/v1/gamify/themes/*`, `src/main.ts` (CORS), authorization matrix |
| AI | `services/ai-api/v1/themes/*` (generator, later) |
| Web | `apps/web/nuxt.config.ts`, `app/app.vue`, `app/assets/css/main.css`, `app/theme/*`, `app/components/{theme,brand,landingpage}/*`, three theme consumers, `app/lib/*`, `app/plugins/auth.server.ts`, `public/*` |
| Infra | `docker-compose*.yml`, `infra/nginx/nginx.conf`, `infra/scripts/*` |
| Docs | `docs/architecture/*theme*`, `docs/README.md`, `docs/progress-tracker.md` |

Out of scope for this plan: new microservices, a game engine (§63), payment gateways, autonomous self-improvement before a frozen benchmark exists.

## 2. Executor contract

Read `AGENTS.md` and `CLAUDE.md` before starting. They win over this document on rules.

| Rule | Detail |
|---|---|
| One task at a time | Finish the task's **Verify** step before starting the next. Stop and report on the first failure. |
| Evidence | Every claim carries a command and its result, or a `file:line`. Status values: `DONE`, `PARTIAL`, `BLOCKED`, `NOT STARTED`. Never write `DONE` for something you did not run. |
| Audit first | Before touching code, run the `codebase-memory-mcp` steps in `AGENTS.md` ("Code audit"). Confirm zero-caller and "does not exist" claims with `grep`. |
| Web verification | Every UI task ends with the Playwright MCP matrix in `AGENTS.md` ("Web verification"). Screenshots go to `.playwright-mcp/`. |
| No comments | No comments in code, Dockerfiles, compose, nginx or config files. |
| Git | Never `git add`, `commit`, `push`, `reset --hard`, `rebase`, `stash drop`. Report changed and untracked files at the end. |
| Prisma | Never `prisma format`. Never edit an applied migration. Write new migrations by hand using `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. Test only on a scratch database, never the dev one. |
| Secrets | Never print values from `.env`. Never write a token into a tracked file, a doc or a log. |
| Language | Code, identifiers and docs in English. User-facing web copy in Indonesian. |
| Decisions | If a task depends on a decision in §5, use the default, mark the task `PARTIAL` if the default is `owner-confirm`, and list it in the report. |
| Size | Keep each task's diff reviewable. If a task grows past roughly 400 changed lines, split it and report. |

## 3. State of the repository (verified 2026-09-30)

### 3.1 Already done in preparation

| ID | Item | Evidence |
|---|---|---|
| P-01 | Folders restructured to `apps/web`, `services/api`, `services/ai-api`, `infra/{nginx,postgres,qdrant,scripts}` | `docker compose config -q` and `docker compose -f docker-compose.prod.yml config -q` exit 0; build contexts `./apps/web`, `./services/api`, `./services/ai-api` |
| P-02 | Renamed Cervana to ReduCera (brand) and `reducera` (identifiers), including containers, networks, volumes, images, users, `.env.example` | Intentional leftovers only: CORS origin `https://cervana.vercel.app` (`services/api/src/main.ts:31`), seed password and email in `services/api/prisma/seed.ts`, applied migrations (must not be edited) |
| P-03 | Databases and role renamed in place, data preserved | Password-authenticated TCP login as `reducera_prod`: `reducera` 58 tables; `reducera_phase1_clean` 79 tables, 11 migrations, 14 users; `reducera_phase1_legacy` 83/14/5; `reducera_phase3_clean` 83/15/367; `reducera_phase4_clean` 83/14/1244. Redis `dbsize` 3. Scripts: `infra/scripts/migrate-legacy-volumes.sh`, `infra/scripts/rename-legacy-databases.sh` |
| P-04 | AI providers: the LLM is one OpenAI-compatible gateway (Flaz, `OPENAI_API_KEY`, `OPENAI_BASE_URL`) with two modes, flash (`OPENAI_MODEL_FLASH`, `pipeline.llm`) and thinking (`OPENAI_MODEL_THINKING`, `pipeline.llm_thinking`); embeddings are computed remotely by Hugging Face Inference (`HF_TOKEN`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_URL`, `EMBEDDING_DIM`). Google Gemini credentials removed. Models chosen by the benchmark in §3.4. | `services/ai-api/config/providers.py`, `config/vector_collections.py`; 20 new or updated tests pass (76 in `config/__tests__`, 3 in `tests`; the 4 `test_rate_limit` failures are pre-existing); live run: BGE-M3 embeddings through the real HF router into a real Qdrant 1024-dim collection, indexing and retrieval worked; vector-size guard raised on a 768 vs 1024 mismatch with the real client |
| P-05 | Boundary violation removed: `services/api/src/common/lib/embeding.ts` had no callers | `trace_path` inbound `callers_total: 0`; `grep` empty; `pnpm jest` 31 suites and 696 tests pass (same as before); `pnpm build` exit 0 with a placeholder `DATABASE_URL` |
| P-06 | Dead LLM dependencies removed: `api` lost `@langchain/community`, `@langchain/core`, `@langchain/textsplitters`, `langchain`, `axios`; `web` lost `@google/generative-ai`; `ai-api` lost 18 Google packages | `pnpm build` exit 0 for `web`; `uv.lock` diff: no existing package changed version |
| P-07 | Root `.gitignore` rewritten (no comments) | Before and after diff: only `.env.prod.example` became visible (intended); no source file newly hidden; no file tracked in `HEAD` is ignored |
| P-08 | Standards written into `AGENTS.md` and `CLAUDE.md`: code audit with `codebase-memory-mcp`; web verification with the Playwright MCP; AI providers; detection grep | Sections "Code audit (codebase-memory-mcp)", "Web verification (Playwright MCP)", "AI providers" |
| P-09 | Junk removed: `services/ai-api/luas.` (8-byte `ar` header) and its stray line in `services/ai-api/.dockerignore`; `.env.prod.example` rebranded | No references found by `grep` |
| P-10 | Local dev `HF_TOKEN` stored in the git-ignored root `.env` only | `git check-ignore -v .env` matches; the value is personal and must be deleted when development ends |
| P-11 | `readme.md` no longer describes the nonexistent SvelteKit `admin` app; architecture diagram redrawn | `grep -n -i "sveltekit\|admin" readme.md` empty |
| P-12 | Web rendering rules (SSR) written into `AGENTS.md` and `CLAUDE.md` | `AGENTS.md` section "Web Rendering Rules" |

### 3.2 Baseline defects found (inputs to the tasks below)

| ID | Finding | Evidence | Task |
|---|---|---|---|
| BL-01 | Deleting a theme deletes curriculum. `SubTopic`, `Lesson`, `Step` foreign keys to `Theme` are `ON DELETE CASCADE`, and `DELETE /gamify/themes/:id` is a plain admin delete | `services/api/prisma/schema.prisma:231,253,291`; live database: `confdeltype = c` for `SubTopic_themeId_fkey`, `Lesson_themeId_fkey`, `Step_themeId_fkey`; `themes.controller.ts` `remove` | TD-03 |
| BL-02 | Light mode is unreadable: body text `rgb(55,65,81)` on background `rgb(3,0,20)`, contrast 2.01:1 (WCAG AA needs 4.5:1) | Playwright at 375x812, `prefers-color-scheme: light`; cause `apps/web/app/assets/css/main.css:89` `--ui-bg: #030014` is fixed for both schemes | TU-02 |
| BL-03 | `<html lang>` is empty, no `<main>` landmark on the landing page, no `theme-color` meta | Playwright `browser_evaluate` on `/` | TU-01, TU-04 |
| BL-04 | Old brand baked into images: the header logo renders "Ceruana/Cervana" (`apps/web/public/pictures/logo.svg`, 561 KB traced vector; `favicon.svg` 562 KB; manifest PNGs; apple touch icon). Text replacement cannot fix it | Screenshot `.playwright-mcp/baseline-landing-375-light.png`; `apps/web/app/components/layout/Header.vue:12` | TU-06 |
| BL-05 | Copy targets the wrong audience: "SMK", "sertifikasi", "BNSP", "SKKNI", "siswa", "guru", "dunia industri" | `apps/web/nuxt.config.ts:8-17`, `pages/index.vue:15-34`, `pages/learn/topics/{index,search}.vue`, `[identifier]/detail.vue:117-149`, `components/landingpage/{HeroSection,CarrouselHome,FeatureSection}.vue` | B-02 |
| BL-06 | Theme values are read raw and concatenated with hex alpha: `${theme?.primary}65`. When `theme` is null (`SubTopic.themeId` is nullable) the result is `undefined65`, which is invalid CSS | `components/my-learning/MainSubTopics.vue:68-149`, `pages/my-learning/sub-topics/[id]/index.vue:55-58,107-127`, `pages/my-learning/lessons/[id]/index.vue:73-76,136` | TU-05 |
| BL-07 | Schema cannot express inheritance: `Topic` has no `themeId`; `Lesson.themeId` and `Step.themeId` are required while their relation is optional | `schema.prisma:230,252,290` | TD-02 |
| BL-08 | `GET /gamify/themes` copies every query key into a Prisma `where` | `services/api/src/v1/gamify/themes/themes.repo.ts:56-60` | TT-04 |
| BL-09 | `toPrismaJson` is dead code; `bg_image` and `planet_image` accept a string or an object in the DTO but the web type only allows an object | `themes.dto.ts:94`, `themes.dto.ts:8-13`, `apps/web/app/interfaces/theme.ts:9-10` | TT-04 |
| BL-10 | Random values during render break hydration: `Math.random()` in a template and in `setup` | `components/my-learning/MainSubTopics.vue:139`, `pages/my-learning/sub-topics/[id]/index.vue:63` | TU-05 |
| BL-11 | Space identity is hard-coded: orange primary scale, neon success and info scales, star field (`.universe-bg`, `panStars`, `shooting-star`), planet SVGs, Orbitron and Exo 2 font faces, dead class `cursor-rocket` | `main.css:4-93`, `pages/(auth)/{login,forgot-password,verify-email}.vue`, `components/ui/DownStarAnimation.vue`, `app.vue:8` | TU-02, TU-05 |
| BL-12 | Two sources of truth for the primary color: `apps/web/app.config.ts` sets `#2e0b73` while `main.css` overrides with orange | both files | TU-02 |
| BL-13 | Seed and content are vocational (SKKNI "Teknisi Akuntansi Yunior"), not the university golden accounting graph (§4). The schema has no structured prerequisites | `services/api/prisma/seed.ts:14,27,588`; `grep -i prereq schema.prisma` returns nothing | A-01, A-02 |
| BL-14 | **SSR calls the wrong URL.** `getApiUrl()` always returns the public `NUXT_PUBLIC_API_URL` (`http://localhost/api/v1` by default). Inside the web container `localhost` is the container itself, so every server-side request fails and the client repeats it. `API_URL_INTERNAL` is passed to the container but `nuxt.config.ts` reads `API_URL` instead | `apps/web/app/lib/api.ts:13-14`, `apps/web/app/plugins/auth.server.ts`, `apps/web/nuxt.config.ts` runtimeConfig, `docker-compose.yml:192-195` | S-01 |
| BL-15 | Duplicate requests on the landing page: `auth/check` twice and `categories?include=topics` twice | Playwright `browser_network_requests` | S-02 |
| BL-16 | `@nuxt/image` cannot find its `sharp` binary, so images are not optimized | build warning `sharp binaries for linux-x64 cannot be found` in both web builds | S-05 |
| BL-17 | `/images/seo/reducera-preview.png` does not exist (`apps/web/public` has no `images/` directory); the old preview file was already missing | `nuxt.config.ts:14,19`; `ls apps/web/public` | B-05 |
| BL-18 | `apps/web` has no test runner or lint script | `apps/web/package.json` scripts | TT-07 |
| BL-19 | Pre-existing failing tests in `ai-api`, identical on `HEAD`: 4 in `config/__tests__/test_rate_limit.py`, 1 in `utils/tools/__tests__/test_memory.py::TestToolSemanticSearchWithFallback::test_falls_back_only_when_no_lesson_match` | Same environment run on old and new code | Q-03 |
| BL-20 | Two `__tests__` packages without a parent `__init__.py` collide when run in one pytest process | `utils/tools/__tests__/test_memory.py` collection error | Q-03 |
| BL-21 | Leftover local-model plumbing although no model runs locally: `hf_cache` volume, `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`; `huggingface-hub` is not even in `uv.lock` | `docker-compose*.yml`, `services/ai-api/Dockerfile:47-53` | R-06 |
| BL-22 | `@nuxt/ui` colors: only `apps/web/app.config.ts` exists at the project root, while Nuxt 4 reads `app/app.config.ts` | `apps/web/app.config.ts` | TU-02 |

### 3.3 Baseline measurements

| Check | Command | Result |
|---|---|---|
| API unit tests | `cd services/api && pnpm jest --silent` | exit 0; 31 suites passed, 9 skipped; 696 tests passed, 133 skipped (database suites skip without `TEST_DATABASE_URL`) |
| API build | `cd services/api && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder pnpm build` | exit 0. Without `DATABASE_URL`, `prisma generate` fails with `PrismaConfigEnvError` |
| Web build | `cd apps/web && pnpm build` | exit 0; warnings: `sharp` binary, old browserslist data |
| ai-api tests, new code | Light environment pinned to `uv.lock` versions, real Qdrant `v1.12.4`, stub `whisper` | `config/__tests__` 72 passed, 4 failed; `utils/tools/__tests__` 10 passed, 1 failed; `tests` 3 passed |
| ai-api tests, `HEAD` code | Same environment | `config/__tests__` 55 passed, 4 failed; `utils/tools/__tests__` 10 passed, 1 failed; `tests` 3 passed. The failing tests are identical, so they are not regressions |
| HF endpoint | `POST https://router.huggingface.co/hf-inference/models/BAAI/bge-m3/pipeline/feature-extraction` with two Indonesian sentences | HTTP 200, shape `(2, 1024)`, L2-normalized |
| Landing at 375x812 dark | Playwright | no horizontal scroll; 4 console errors, all `ERR_CONNECTION_REFUSED` to `localhost:3002` because `api` was not running |

### 3.4 LLM model selection (measured 2026-09-30)

Goal set by the owner: two modes, **flash** for the fastest useful answer and **thinking** for a reasoning model, in both cases the cheapest option that is still the most capable. The gateway served 77 models; 22 were benchmarked with the scripts in `infra/scripts/llm-bench/` (`bench_llm.py` accuracy, latency and structured output; `bench_quiz.py` real quiz generation with the `QuizResponse` schema from `services/ai-api/v1/users_steps/dto.py`, graded by `claude-sonnet-5`; `bench_effort.py` cost and `reasoning_effort`). Four sets of numeric accounting questions with exact answers were used: easy (5), hard (5: bank reconciliation, multi-product break-even, bond price, asset disposal gain, current tax), harder (5 x 2 runs: finance lease PV, percentage of completion, basic EPS, indirect cash flow, moving average inventory).

| Model | Chosen for | Easy 5 | Hard 5 | Harder 10 | Quiz answer keys (2 runs) | Numeric latency | Quiz latency | Output cost per question, reasoning included | Structured output |
|---|---|---|---|---|---|---|---|---|---|
| `gemini/gemini-3.1-flash-lite` | **flash** | 5/5 | 5/5 | 10/10 | 5/5, 5/5, language 5/5 | 1.2–1.7 s | 4.1–4.6 s | $0.00015–0.00035 | `json_schema` and `function_calling` |
| `deepseek-v4-flash` | **thinking** | 5/5 | 5/5 | 10/10 | 5/5, 5/5, language 5/5 | 1.6–6.9 s | 54–59 s | $0.00006–0.00016 | both |
| `gpt-5-mini` | not chosen | — | 5/5 | 10/10 | 5/5, 5/5 | 3.7–10 s | 31–36 s | $0.0012–0.0019 | both |
| `gpt-5-nano` | not chosen | — | 5/5 | 10/10 | 5/5, 5/5 | 3.6–19.7 s | 62–65 s | $0.0004–0.0012 | both |
| `deepseek-v4-pro` | not chosen | — | 5/5 | 10/10 | judge call failed | 3.3–9.9 s | 65–80 s | $0.0007–0.0024 | both |
| `gpt-5.6-luna` | rejected | — | 5/5 | 10/10 | **3/5, 3/5** (wrong answer keys) | 1.3–3.3 s | 6.5–22.9 s | $0.00013–0.0002 | both |
| `gpt-4.1-mini` (owner's previous default) | rejected | 5/5 | 3/5 | 8/10 | — | 1.8–3.2 s | — | $0.0002–0.0004 | both |
| `MiniMax-M3.1-Flash-Preview` | rejected (cheapest, preview, errors) | 5/5 | 4/5 | 8/10 | — | 1.4–4.6 s | — | $0.00002–0.00004 | `function_calling` only |

Reading the table:

- **Flash = `gemini/gemini-3.1-flash-lite`.** It is the only fast, non-reasoning model that answered all 20 numeric questions and both quizzes correctly, with a stable first token around 1 s. Cheaper models were less accurate (`gpt-4.1-nano` 4/5 twice, `MiniMax` preview 8/10) or slow and inconsistent (`deepseek-v4-flash` 5.3–6.9 s in two runs).
- **Thinking = `deepseek-v4-flash`.** Among the models that were fully correct on every set and produce reasoning, it is the cheapest by a wide margin (10x cheaper per question than `gpt-5-mini`, 3–7x cheaper than `gpt-5-nano` once reasoning tokens are counted) and it supports both structured-output methods with a 1M-token context. Its cost is latency on long generations (about one minute for a quiz), which is why thinking is used only for background or planning work.
- **Quiz generation stays on flash.** Flash produced correct keys in 4 s; the thinking model needed about 55 s for the same result. If key quality slips in production, switching one call site to `pipeline.llm_thinking` is a one-line change (`generate_quiz_pipeline.py`).
- **Call sites in thinking mode**: lesson content generation (`v1/learning/content_pipeline.py:202`) and learning-path planning (`v1/users_steps/generate_user_steps_pipeline.py:341`). Everything else uses flash.
- **A `gemini/...` model id is allowed** because it is served through the OpenAI-compatible gateway with the single gateway key. Google Gemini credentials and SDKs stay removed; the detection grep in `AGENTS.md` targets those, not model ids.

Caveats, so nobody over-reads the numbers: small samples (5–10 questions per set, 2 quiz runs), one afternoon, and gateway latency varies (`gpt-5-nano` took 19.7 s in one run and 3.6 s in another). The gateway reports `reasoning_tokens` separately from `completion_tokens`; costs above assume they are billed as output. Prices come from the Flaz catalog on 2026-09-30. `reasoning_effort` and per-quiz token cost were not measured because the gateway key was blocked mid-run (see §11). The wiring in `providers.py` is covered by mock tests and by the same LangChain call shape used in the benchmark, but a live end-to-end run of the final configuration is still open (task R-03).

### 3.5 Not verified (do not assume)

- Full stack `docker compose up -d --build` (only `postgres` and `redis` were started for the database migration).
- A live LLM call through the final `providers.py` wiring: the Flaz key was blocked by the gateway (`401 Key is blocked`) after about 300 benchmark calls, so the owner must unblock or replace it. Temperature on the flash model is unset on purpose until this is tested (`OPENAI_FLASH_TEMPERATURE`).
- The production server: the two scripts in `infra/scripts/` have not been run there.
- A full `uv sync` of `ai-api` (it pulls `torch` through `openai-whisper`).
- Any end-to-end or accessibility test of pages other than the landing page.

---

## 4. Design — audit outputs A–N (master prompt §219)

Evidence comes from `codebase-memory-mcp` (project `home-misbahul45-code-reducera`, index generation `2026-09-30T08:38:13Z`, `freshness: metadata_match`), confirmed with `grep` and direct reads. Index blind spots: `apps/web/app/assets/css/main.css`, `infra/nginx/*.conf`, four migration files and `topic-mastery-backfill.service.ts:18` are `parse_partial`; they were read directly.

### A. Current architecture summary

| Service | Stack | Owns | Notes |
|---|---|---|---|
| `services/api` :3002 | NestJS 11, Prisma 7, PostgreSQL 15, BullMQ, Zod 4 | Database, auth, authorization, commerce, learner state, gamification | Modules under `src/v1`: articles, auth, categories, chat, classes, commerce, curriculum, entitlements, gamify (daily-logs, leaderboards, streaks, themes), internal, learner-model, learning, ledger, marketplace, material, notifications, orders, payments, payouts, queue, quiz, refunds, sse, teacher, tenants, uploads, users. Global prefix `api/v1`. No LLM or embedding code after P-05 |
| `services/ai-api` :3003 | FastAPI, Celery, LangChain, LlamaIndex, Qdrant | LLM calls, embeddings, retrieval, agent pipelines | Packages `v1/{learning,resources,users_steps}`, `config/`, `utils/tools/`. LLM through `providers.build_chat_model`, embeddings through `providers.build_embedding_model` |
| `apps/web` :3000 | Nuxt 4 (`ssr: true`), Nuxt UI 3.3, Tailwind 4, Pinia, TanStack Query | Learner UI only | Pages: landing, auth, `learn/*` (topics, profile, gamify), `my-learning/*` (sub-topics, lessons, steps, topics). There is no admin or creator UI, although the readme mentions one |
| `infra/*` | nginx, postgres init, qdrant config, scripts | Routing `/`, `/api/`, `/ai/`; gzip on; static `expires 30d` | No brotli |

### B. Accounting coupling map (classes: CORE, DOMAIN, THEME, LEGACY, TEST, DOCUMENTATION)

| Location | Class | Finding | Action |
|---|---|---|---|
| `apps/web/nuxt.config.ts:8-17`, `pages/index.vue:15-34`, `pages/learn/topics/{index,search}.vue`, `[identifier]/detail.vue:117-149` | DOMAIN copy in the shell | SMK certification wording | B-02 |
| `apps/web/app/components/landingpage/{HeroSection,CarrouselHome,FeatureSection}.vue` | DOMAIN copy | "Sertifikasi", "Simulasi Industri", "Menjadi Guru", teacher dashboard for "siswa" | B-02 |
| `apps/web/app/constants/index.ts:83+` | LEGACY | Long SKKNI lesson text bundled into client code | A-02 (move to seeded content; audit importers first) |
| `services/api/prisma/seed.ts:14,27,588` | LEGACY | Vocational "Teknisi Akuntansi Yunior" data, not the university graph | A-02 |
| `services/ai-api/v1/learning/dto.py:24-60`, `services/api/src/v1/chat/contents/contents.dto.ts:29` | DOCUMENTATION (OpenAPI examples) | "Buku Akuntansi SMK Kelas XI" | B-02 |
| `services/ai-api/config/__tests__/test_prompt_segmentation.py` | TEST | Fixtures only | none |
| Accounting sandbox, chart of accounts, journal, trial balance | none in code or schema | Exists only in `docs/architecture/accounting-sandbox.md` (`planned`). `grep -i "sandbox\|journal\|debit"` over `src`, `prisma/schema.prisma`, `ai-api` is empty | A-06 |
| `LedgerTransaction` (`schema.prisma:1836`) | CORE (real money) | Must never be referenced by the sandbox (§20) | guard in A-06 |
| Domain context for the tutor (§25) | missing | `llm_prompt` and the pipelines are domain-generic; no explicit `domain=accounting` context | A-05 |

### C. Theme implementation map

| Layer | What exists | Evidence |
|---|---|---|
| Database | `Theme` (`title`, `description`, `primary`, `secondary`, `tertiary`, `quaternary`, `bg_image` JSON, `planet_image` JSON), `ThemeIcon` (`name`, `imageIcon` JSON). No slug, status, default flag, ownership, version, mood, tokens, atmosphere or variants | `schema.prisma:724-755` |
| API | `ThemesController` under `/api/v1/gamify/themes`: `POST`, `POST icons`, `GET`, `GET :id/icons`, `GET :id`, `PATCH :id`, `DELETE :id`, `DELETE icons/:id`. Admin-only writes; reads are `@AuthenticatedOnly()` (so the landing page cannot read a theme). Hard delete cascades curriculum (BL-01). No cache, no lifecycle, no validation of colors or assets | `themes.controller.ts`, `themes.repo.ts`, `gamify.module.ts` |
| Web | One type (`interfaces/theme.ts`). Colors read raw in three places (BL-06). Global tokens are a fixed space palette (BL-11) | `apps/web/app/**` |
| Seed | Themes and icons created in `prisma/seed.ts:599-669`, assigned round-robin to sub-topics | `seed.ts` |

### D. Theme-to-curriculum mapping

`Topic` (no theme) → `SubTopic.themeId String?` → `Lesson.themeId String` (required) → `Step.themeId String` (required). Target (§41): `Topic.themeId String?`, and every lower level nullable, inheriting from the nearest ancestor that has one, then falling back to the default theme. Variants (LEARN, PRACTICE, CHALLENGE, EXAM) are derived from the learning mode at runtime, not stored.

### E. Theme UX usage

Three consumers read `theme.primary` and `theme.secondary` raw: `MainSubTopics.vue`, `sub-topics/[id]/index.vue`, `lessons/[id]/index.vue` (lines in BL-06). Everything else uses the global CSS variables in `main.css`. There is no theme picker, no preview and no user preference. `ui.colorMode` is enabled in `nuxt.config.ts:58` but no component reads it.

### F. Theme generator capability

None: no route, service, prompt or UI.

### G–L. Impact summary

| Area | Impact |
|---|---|
| Database (G) | Additive migration on `Theme` (status, scope, tenant, default flag, slug, version, mood, tokens, atmosphere, variants, provenance); `Topic.themeId`; `Lesson.themeId` and `Step.themeId` nullable; all four foreign keys `ON DELETE SET NULL`; partial unique index for the single default; check constraints. Later: `SubTopicPrerequisite`, sandbox tables |
| API (H) | New intent endpoints for the theme lifecycle; `GET /gamify/themes/default` public and cacheable; optional `resolve`; filter whitelist; asset policy; generator endpoint. `AUTHORIZATION_MATRIX.md` and `route-access.spec.ts` must stay green |
| AI (I) | Theme proposal endpoint in `ai-api` (LLM lives there). Tutor receives `themeMood`, `visualStyle`, `learningMode` as presentation hints only (§60). Explicit `domain=accounting` context |
| Frontend (J) | Theme layer (`app/theme/*`), `ThemeShell`, `ThemeBackground`, `BrandLogo`, refactor of three consumers, copy, assets, SSR and performance work |
| Security (K) | Theme asset URL policy (no SSRF vectors, size, type), no AI auto-publish, admin-only lifecycle, no secrets in docs. Token in `.env` is dev only |
| Accessibility (L) | Contrast enforced in the validator and in tests, `prefers-reduced-motion`, focus ring token, `lang`, `main` landmark, keyboard, `forced-colors` |

### M. Migration strategy

Additive first (§124). One migration `theme_foundation` on a scratch database, then `migrate deploy`, then `migrate diff` must be empty. Relaxing `NOT NULL` and changing `CASCADE` to `SET NULL` are not destructive. The old columns `primary`, `secondary`, `tertiary`, `quaternary`, `bg_image`, `planet_image` stay; the theme layer maps them into tokens when `tokens` is null, so old rows keep rendering (§154). Nothing applied is edited. Production applies with `docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate`.

### N. Ordered implementation plan

See §8. The theme track is strictly **DB → theme → UI** (TD, TT, TU), with SSR (S) interleaved where it unblocks the UI.

---

## 5. Design — decisions

`owner-confirm` means the executor proceeds with the default and marks the affected task `PARTIAL`.

| ID | Question | Default | Type |
|---|---|---|---|
| DC-01 | Position the product for universities and rewrite SMK copy | Yes, copy in §6 | owner-confirm |
| DC-02 | Embedding model | `BAAI/bge-m3`, 1024 dimensions, no prefixes, multilingual, served live by `hf-inference` on 2026-09-30. Alternative `intfloat/multilingual-e5-base` (768, needs `query:` and `passage:` prefixes). Changing it needs new Qdrant collection names and a re-embed | owner-confirm |
| DC-03 | Production Qdrant collections | If production holds Gemini vectors, set `QDRANT_COLLECTION` and `QDRANT_MEMORY_COLLECTION` to new names and re-embed; `ai-api` refuses to start on a size mismatch | owner action |
| DC-04 | CORS origin `https://cervana.vercel.app` in `main.ts:31` | Move to env `CORS_EXTRA_ORIGINS` (comma separated); keep the value in production `.env` until the domain migrates | owner-confirm |
| DC-05 | SEO preview image | Generate `apps/web/public/images/seo/reducera-preview.png` (1200x630) by screenshotting the ocean hero with Playwright | default |
| DC-06 | Default color scheme | `system`, stored in a cookie so SSR renders the right class; fallback `light` | default |
| DC-07 | Theme ownership in V1 | `GLOBAL`, admin-owned; `scope` and `tenantId` exist but tenant themes stay disabled | default |
| DC-08 | `ThemeVersion` table | Not in V1. `Theme.version` (integer) plus `publishedAt` is enough until a published theme must change while content depends on it (§79, §121) | default |
| DC-09 | Logo | A new `BrandLogo.vue` (inline SVG mark plus the bundled Ubuntu font). A designer's asset can replace it later | owner-confirm |
| DC-10 | Fonts | Headings and body use Ubuntu; remove the Exo 2 and Orbitron faces after `grep` shows they are unused | default |
| DC-11 | Seeded curriculum | Replace the vocational seed with the golden accounting graph (§4) as structured sub-topics with prerequisites; keep the SKKNI content out of the default seed | owner-confirm |
| DC-12 | Theme name | Slug `reducera-ocean`, title "Samudra" | default |

---

## 6. Design — business direction and copy contract

### 6.1 Definition (§2, §215)

> ReduCera is a university-focused, AI-powered Accounting learning ecosystem built around a circular learning economy and immersive learning atmospheres.

Loop: Learning → Practice → Mastery → Expertise → Creation → Knowledge sharing → Marketplace → Creator value → Reinvestment → Learning. The theme accompanies the journey and never determines it (§191).

ReduCera is **not** an ERP, professional accounting software, a banking or real financial system, a K-12 or vocational-school platform, a generic chatbot, an ordinary course marketplace, or a visual-only gamification app.

### 6.2 Truthfulness rule (no fake success)

Marketing copy may describe only what runs today, plus clearly labeled "Segera" (soon) items.

| Status | Capability | Evidence |
|---|---|---|
| Live | AI tutor chat, adaptive learning-style intake, structured topic, sub-topic, lesson and step curriculum, quizzes, streaks, leaderboard, achievements, topic purchase | `components/my-learning/{Chatbot,LearningStyleForm,PersonalityQuiz,LessonQuizModel}.vue`, `pages/learn/(gamify)/*`, `pages/learn/topics/[identifier]/order.vue` |
| Backend only | Articles, classes, orders, payments, wallets, payouts, refunds, entitlements | `services/api/src/v1/*`; no creator or wallet screens in the web app |
| Soon | Accounting sandbox (journal, ledger, trial balance), article and class marketplace screens, creator earnings screens, AI credits | sandbox and AI credits have no code (`AICreditWallet` is schema only) |

### 6.3 Terminology

| Old | New |
|---|---|
| siswa, pelajar | mahasiswa |
| SMK Akuntansi | akuntansi perguruan tinggi (or just "akuntansi") |
| sertifikasi, BNSP, SKKNI, kompetensi kerja | penguasaan (mastery) |
| Menjadi Guru, guru | Jadi Kreator, kreator (the database role stays `TEACHER`) |
| dunia industri | dunia profesi akuntansi |
| AI Learning Platform | Ekosistem Belajar Akuntansi |

### 6.4 Proposed copy (Indonesian, owner approves)

| Place | Text |
|---|---|
| Site title (`nuxt.config.ts`, `pages/index.vue`) | `ReduCera – Ekosistem Belajar Akuntansi Berbasis AI untuk Mahasiswa` |
| Meta and OG description | `ReduCera adalah platform belajar akuntansi untuk mahasiswa dengan tutor AI yang menyesuaikan cara belajarmu, kurikulum akuntansi terstruktur, dan atmosfer belajar yang membuat setiap konsep terasa berbeda.` |
| OG and Twitter title | `ReduCera – Belajar Akuntansi dengan Tutor AI` |
| OG and Twitter description | `Kurikulum akuntansi terstruktur, tutor AI adaptif, dan atmosfer belajar imersif untuk mahasiswa.` |
| Topic pages title | `Topik Akuntansi | ReduCera` |
| Keywords | `ReduCera, belajar akuntansi, akuntansi mahasiswa, tutor AI, jurnal umum, buku besar, neraca saldo, laporan keuangan, gamifikasi` |
| Hero wordmark | `ReduCera` |
| Hero subtitle | `Ekosistem Belajar Akuntansi` |
| Hero paragraph | `Kuasai akuntansi dari persamaan dasar sampai laporan keuangan bersama tutor AI yang mengenal cara belajarmu. Setiap konsep punya suasana belajarnya sendiri, dari perairan dangkal sampai laut dalam.` |
| Hero buttons | `Mulai Belajar`, `Jadi Kreator` |
| Hero chips | `Tutor AI`, `Adaptif`, `Gamifikasi`, `Kurikulum` |
| Feature cards (live) | AI tutor, kurikulum terstruktur, latihan dan kuis, streak dan papan peringkat |
| "Segera" strip | `Sandbox Jurnal`, `Marketplace Materi dan Kelas`, `Kredit AI`, each with a `Segera` badge |
| Loop section | Belajar → Berlatih → Menguasai → Berkarya → Berbagi → Berpenghasilan → Belajar Lagi; the first two are labeled live, the rest `Segera` |
| OpenAPI examples | replace "Buku Akuntansi SMK Kelas XI Hal. 23" with "Buku Akuntansi Keuangan Dasar, Bab 2" |

The copy guard test in B-04 fails the build if a banned term returns.

---

## 7. Design — default ocean theme specification ("Samudra")

### 7.1 Concept

Depth is the metaphor (§43, §61): the deeper the learning mode, the calmer and more focused the scene. The default theme is always available: it is the static CSS in `main.css`, the JSON constant in the web app, and the seeded default row in the database, in that order of authority when the database is unreachable.

| Variant (learning mode) | Depth | Particles (density) | Motion intensity | Lighting | Waves | Notes |
|---|---|---|---|---|---|---|
| `LEARN` | Perairan dangkal | 0.30 | 0.25 | 0.55 | on | Soft, calm, welcoming |
| `PRACTICE` | Terumbu | 0.20 | 0.15 | 0.45 | off | Focused; stronger card borders |
| `CHALLENGE` | Palung | 0.10 | 0.10 | 0.30 | off | AAA contrast for muted text and borders |
| `EXAM` | Abisal | 0 (disabled) | 0 | 0 | off | Flat background, no decorative layers |

Variants change presentation only. They never change grading, mastery or accounting validation (§61, §62).

### 7.2 Tokens and measured contrast

Every hex is `#RRGGBB`. Contrast ratios were computed with the WCAG 2.x relative-luminance formula.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F2FAFB` | `#04202D` | page background |
| `surface` | `#FFFFFF` | `#0A3145` | cards, panels |
| `fg` | `#0A2533` | `#E6F7FA` | body text |
| `muted` | `#3F5B69` | `#A5CBD6` | secondary text |
| `border` | `#B7D9E1` | `#2A6178` | decorative dividers only |
| `borderStrong` | `#5B8896` | `#4C8BA3` | input and control boundaries |
| `primary` | `#0B7285` | `#3CC8DA` | brand, links, primary buttons |
| `primaryFg` | `#FFFFFF` | `#03202B` | text on `primary` |
| `secondary` | `#1C5D99` | `#6FA8F0` | secondary actions |
| `secondaryFg` | `#FFFFFF` | `#04182B` | text on `secondary` |
| `accent` | `#C2410C` | `#FF9A76` | highlights, coral |
| `focus` | `#0B5FA8` | `#7DD3FC` | focus ring |
| `foam` | `#DDF3F4` | `#0F4A61` | subtle fills |
| `sand` | `#E9DDB8` | `#3A4A52` | warm accents |

| Pair | Light | Dark | Requirement |
|---|---|---|---|
| `fg` on `bg` | 14.97 | 15.24 | ≥ 4.5 |
| `fg` on `surface` | 15.85 | 12.38 | ≥ 4.5 |
| `muted` on `bg` | 6.81 | 9.69 | ≥ 4.5 |
| `muted` on `surface` | 7.21 | 7.88 | ≥ 4.5 |
| `primaryFg` on `primary` | 5.59 | 8.40 | ≥ 4.5 |
| `secondaryFg` on `secondary` | 6.83 | 7.29 | ≥ 4.5 |
| `primary` text on `surface` | 5.59 | 6.80 | ≥ 4.5 |
| `accent` text on `surface` | 5.18 | 6.59 | ≥ 4.5 |
| `focus` on `bg` | 6.17 | 10.08 | ≥ 3 |
| `borderStrong` on `bg` | 3.67 | 4.42 | ≥ 3 |
| `borderStrong` on `surface` | 3.88 | 3.59 | ≥ 3 |

`border` is decorative (1.41:1 on light `bg`); a control must never rely on it alone. `CHALLENGE` overrides: light `muted #33505E` (8.10 on `bg`) and `borderStrong #3F6C7B` (5.45); dark `muted #BFE0E9` (12.05) and `borderStrong #6FAFC7` (6.91).

### 7.3 Nuxt UI scales

Register the three scales as Tailwind theme colors named `reef` (primary), `tide` (secondary) and `shell` (neutral) with `@theme static { --color-reef-50: #E6F8FB; ... }`, then point `app.config.ts` at them (`ui.colors.primary: 'reef'`). This is the documented Nuxt UI 3.3 route (Getting started, Theme); do not overwrite `--ui-color-primary-*` by hand, because the module injects those variables and the order of the two style sources is not guaranteed. Nuxt UI resolves `--ui-primary` to step 500 in light mode and 400 in dark mode, so those two steps equal the tokens above and no `--ui-primary` override is needed. Steps 50–950, all monotonic in luminance:

| Step | primary | secondary | neutral |
|---|---|---|---|
| 50 | `#E6F8FB` | `#EAF3FD` | `#F2FAFB` |
| 100 | `#C4EDF3` | `#D0E3FA` | `#E4F1F4` |
| 200 | `#92DDE8` | `#A9CCF6` | `#CBE4EA` |
| 300 | `#63D0E0` | `#8BBAF3` | `#A9CBD4` |
| 400 | `#3CC8DA` | `#6FA8F0` | `#7FA6B2` |
| 500 | `#0B7285` | `#1C5D99` | `#5B8896` |
| 600 | `#0A6272` | `#184E82` | `#3F5B69` |
| 700 | `#095260` | `#143F6A` | `#2B4553` |
| 800 | `#08424D` | `#0F3153` | `#0A3145` |
| 900 | `#06343D` | `#0B2440` | `#0A2533` |
| 950 | `#042A31` | `#071A2E` | `#04202D` |

Success, warning, error and info use Tailwind palettes through `app/app.config.ts` (`emerald`, `amber`, `red`, `sky`); the neon custom scales are deleted.

### 7.4 Atmosphere (CSS only, budgets)

- Layers, back to front: depth gradient from `bg` to a `primary`/`secondary` mix; caustic light (two large soft gradients, `transform` drift 60 s, opacity from `lighting`); bubbles; two-layer wave strip (inline SVG data URI under 2 KB) pinned to the bottom.
- Bubbles: `round(density × 40)` elements, capped at 12, and 6 below 640 px. Position, size, delay and duration come from a deterministic function of the index. Never `Math.random()` (SSR must equal client).
- Only `transform` and `opacity` animate. No video, no canvas, no image asset in the default theme. Decorative CSS and SVG added to the main stylesheet stay under 6 KB gzip.
- Off when: `prefers-reduced-motion: reduce`, variant `EXAM`, `data-rc-motion="off"`, or `forced-colors: active`. Accessibility wins over user preference and over theme (§58).
- World visual (§46): the old planet becomes a pearl, a round orb with a foam highlight built from `radial-gradient` and the resolved tokens. The DOM and per-node identity in `MainSubTopics.vue` stay; only colors and shapes change.
- Hero: an inline SVG component (`OceanHero.vue`, under 4 KB) replaces the astronaut illustration.

### 7.5 Legacy rows

When `tokens` is null, build the tokens from the legacy fields: `primary`, `secondary`, `accent = tertiary ?? default`, `foam = quaternary ?? default`; all other tokens come from the default theme for the current scheme. Accept only `#RRGGBB` (expand `#RGB`); anything else falls back for that field only. `primaryFg` is `#FFFFFF` or the dark foreground, whichever has the higher contrast against `primary`. `bg_image` and `planet_image` may be a URL string or `{ fileId, url }`; both normalize to `{ url }`.

### 7.6 Canonical JSON

The same file lives in `services/api/prisma/seed-data/reducera-ocean.theme.json` and `apps/web/app/theme/reducera-ocean.theme.json`; `infra/scripts/check-theme-sync.sh` fails when they differ.

```json
{
  "slug": "reducera-ocean",
  "title": "Samudra",
  "description": "Laut sebagai dunia belajar: perairan dangkal untuk memahami, palung untuk menantang diri.",
  "mood": ["calm", "analytical", "welcoming"],
  "primary": "#0B7285",
  "secondary": "#1C5D99",
  "tertiary": "#C2410C",
  "quaternary": "#DDF3F4",
  "tokens": {
    "light": {
      "bg": "#F2FAFB", "surface": "#FFFFFF", "fg": "#0A2533", "muted": "#3F5B69",
      "border": "#B7D9E1", "borderStrong": "#5B8896", "primary": "#0B7285", "primaryFg": "#FFFFFF",
      "secondary": "#1C5D99", "secondaryFg": "#FFFFFF", "accent": "#C2410C", "focus": "#0B5FA8",
      "foam": "#DDF3F4", "sand": "#E9DDB8"
    },
    "dark": {
      "bg": "#04202D", "surface": "#0A3145", "fg": "#E6F7FA", "muted": "#A5CBD6",
      "border": "#2A6178", "borderStrong": "#4C8BA3", "primary": "#3CC8DA", "primaryFg": "#03202B",
      "secondary": "#6FA8F0", "secondaryFg": "#04182B", "accent": "#FF9A76", "focus": "#7DD3FC",
      "foam": "#0F4A61", "sand": "#3A4A52"
    }
  },
  "atmosphere": {
    "particles": { "enabled": true, "density": 0.3 },
    "motion": { "intensity": 0.25 },
    "lighting": { "intensity": 0.55 },
    "waves": true,
    "caustics": true
  },
  "variants": {
    "PRACTICE": { "atmosphere": { "particles": { "enabled": true, "density": 0.2 }, "motion": { "intensity": 0.15 }, "lighting": { "intensity": 0.45 }, "waves": false } },
    "CHALLENGE": {
      "atmosphere": { "particles": { "enabled": true, "density": 0.1 }, "motion": { "intensity": 0.1 }, "lighting": { "intensity": 0.3 }, "waves": false },
      "tokens": {
        "light": { "muted": "#33505E", "borderStrong": "#3F6C7B" },
        "dark": { "muted": "#BFE0E9", "borderStrong": "#6FAFC7" }
      }
    },
    "EXAM": { "atmosphere": { "particles": { "enabled": false, "density": 0 }, "motion": { "intensity": 0 }, "lighting": { "intensity": 0 }, "waves": false, "caustics": false } }
  }
}
```

---

## 8. Step-by-step

Execution order: **R → TD → TT → S → TU → B → TG → A → Q**. The data flow is one way.

```mermaid
flowchart LR
  DB[(Postgres Theme rows)] --> API[ThemesService, validator, cache]
  API -->|GET /gamify/themes/default, include=theme| SSR[Nuxt SSR]
  CODE[reducera-ocean.theme.json] -->|fallback| SSR
  SSR --> RES[ThemeResolver, normalize, tokens]
  RES --> CSS[CSS variables in first HTML]
  CSS --> UI[Components]
```

### 8.1 Track R — repository and operations

| ID | Task | Files | Verify |
|---|---|---|---|
| R-01 | Done, see P-11 | `readme.md` | — |
| R-02 | Move the hard-coded CORS origin to env `CORS_EXTRA_ORIGINS` (comma separated). Add a pure `parseOrigins` helper with a spec. Add the variable to `.env.example` and the `api` service in both compose files (DC-04) | `services/api/src/main.ts:28-34`, `.env.example`, `docker-compose*.yml` | `pnpm jest` green; `docker compose config -q` exit 0; `grep -rn "cervana.vercel.app" services/api/src` empty |
| R-03 | Bring up the whole stack and confirm it is healthy. Needs `INTERNAL_AI_API_SECRET`, `MANUAL_PAYMENT_ACCOUNTS`, `OPENAI_API_KEY` in `.env` (ask the owner; never invent secrets) | root | `docker compose up -d --build`; `docker compose ps` all healthy; `curl -fsS http://localhost/nginx-health`; `curl -fsS http://localhost/api/v1/docs`; Playwright `/` with zero console errors. Mark `BLOCKED` with the missing variable names if secrets are absent |
| R-04 | Baseline the dev database `reducera` (no `_prisma_migrations` table): follow `docs/architecture/PHASE_1_REPORT.md`, `prisma migrate resolve --applied` for the five pre-Phase-1 migrations (`20251202032210_final_db`, `20251202230940_final_db`, `20260115090000_idempotency_key`, `20260115100000_domain_model`, `20260115110000_content_job_fields`), then `migrate deploy` | `services/api/prisma/migrations` | `prisma migrate status` up to date; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` empty |
| R-05 | **Owner-run cleanup** after R-03 passes. The executor prints these and waits: `docker rm cervana_postgres cervana_redis cervana_api`; `docker volume rm cervana_postgres_data cervana_redis_data`; `docker network rm cervana_network`; delete `.env.cervana.bak`. On the production server run `infra/scripts/migrate-legacy-volumes.sh` and `infra/scripts/rename-legacy-databases.sh` with the stack stopped | — | `docker ps -a`, `docker volume ls` show no `cervana_*` |
| R-06 | Remove local-model plumbing (BL-21) after `grep -rn "huggingface_hub\|transformers\|sentence_transformers" services/ai-api --include=*.py` is empty: drop `hf_cache`, `HF_HOME`, `HF_HUB_ENABLE_HF_TRANSFER`, `HF_ENDPOINT`, `HF_HUB_HTTP_TIMEOUT`; keep `HF_TOKEN` | `docker-compose*.yml`, `services/ai-api/Dockerfile` | both `config -q` exit 0; ai-api image builds; `curl -fsS http://localhost:3003/` |

### 8.2 Track TD — database

Run the audit first: `search_graph` for `Theme`, `themeId`, `ThemeIcon` in `home-misbahul45-code-reducera`; confirm the only writers are `themes.repo.ts` and `prisma/seed.ts`.

**TD-01 — Schema** (`services/api/prisma/schema.prisma`, edit by hand, never `prisma format`)

```prisma
enum ThemeStatus {
  DRAFT
  REVIEW
  PUBLISHED
  SUSPENDED
  ARCHIVED
}

enum ThemeScope {
  GLOBAL
  TENANT
}

model Theme {
  slug        String?     @unique
  status      ThemeStatus @default(PUBLISHED)
  scope       ThemeScope  @default(GLOBAL)
  tenantId    String?
  tenant      Tenant?     @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  isDefault   Boolean     @default(false)
  version     Int         @default(1)
  mood        String[]    @default([])
  tokens      Json?
  atmosphere  Json?
  variants    Json?
  provenance  Json?
  createdById String?
  publishedAt DateTime?
  archivedAt  DateTime?
  topics      Topic[]

  @@index([status, scope])
  @@index([tenantId])
}
```

Add only these lines to the existing model; add `themes Theme[]` to `Tenant`; add `themeId String?` and `theme Theme? @relation(fields: [themeId], references: [id], onDelete: SetNull)` to `Topic`; make `Lesson.themeId` and `Step.themeId` `String?`; change the three existing relations to `onDelete: SetNull`. Existing rows default to `PUBLISHED` and `GLOBAL` so nothing disappears.

**TD-02 — Migration** `services/api/prisma/migrations/20260930130000_theme_foundation/migration.sql`

1. Create a scratch database (`reducera_theme_scratch`), point `DATABASE_URL` at it, run `pnpm prisma migrate deploy` with the schema at head.
2. Generate the DDL: `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, save it as `migration.sql`.
3. Make sure the DDL orders `DROP NOT NULL` before the foreign keys change, then append this hand-written tail (Prisma does not know these):

```sql
UPDATE "Theme" SET "slug" = 'legacy-' || "id", "publishedAt" = "createdAt" WHERE "slug" IS NULL;
CREATE UNIQUE INDEX "Theme_single_default" ON "Theme" ("isDefault") WHERE "isDefault";
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_default_is_published_global" CHECK (NOT "isDefault" OR ("status" = 'PUBLISHED' AND "scope" = 'GLOBAL'));
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_tenant_scope" CHECK (("scope" = 'GLOBAL' AND "tenantId" IS NULL) OR ("scope" = 'TENANT' AND "tenantId" IS NOT NULL));
```

**Verify**: drop and recreate the scratch database, `migrate deploy` again from scratch; `migrate diff` prints an empty script; repeat on a copy of a populated database (`CREATE DATABASE reducera_theme_copy TEMPLATE reducera_phase3_clean`) and confirm row counts of `Theme`, `SubTopic`, `Lesson`, `Step` are unchanged before and after.

**TD-03 — Delete safety (BL-01)**: covered by the `SET NULL` change. Verify on the scratch database: create a theme, attach it to a sub-topic, lesson and step, delete the theme, assert all three rows still exist with `themeId` null.

**TD-04 — Seed the default theme**

1. Create `services/api/prisma/seed-data/reducera-ocean.theme.json` from §7.6.
2. Add `services/api/prisma/seed-theme.ts`: upsert by `slug`, set `status PUBLISHED`, `scope GLOBAL`, `isDefault true`, `publishedAt now()`; in one transaction unset any other default first. Idempotent.
3. Add `"seed:theme": "tsx prisma/seed-theme.ts"` to `package.json`. Production runs this script; it never wipes data.
4. `prisma/seed.ts:599-600` currently deletes all themes; call the new upsert before the loop at `:644` and stop deleting the default theme.

**Verify**: run twice against the scratch database; `SELECT slug, "isDefault", status FROM "Theme" WHERE "isDefault"` returns exactly one row.

**TD-05 — Invariant tests** in `services/api/src/v1/__tests__/db-invariants.int.spec.ts` (skips without `TEST_DATABASE_URL`; use the scratch database): deleting a theme keeps curriculum rows; a second `isDefault = true` insert fails; a default that is not `PUBLISHED` and `GLOBAL` is rejected; `TENANT` scope without `tenantId` is rejected. **Verify**: `TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/db-invariants.int.spec.ts` passes.

### 8.3 Track TT — theme layer

| ID | Task | Files | Verify |
|---|---|---|---|
| TT-01 | Zod contract: `ThemeTokensSchema` (14 keys, `^#[0-9a-fA-F]{6}$`), scheme pair, `AtmosphereSchema` (density 0–0.6, intensity 0–1), `VariantsSchema` (keys `LEARN`, `PRACTICE`, `CHALLENGE`, `EXAM`), `NormalizedThemeSchema` (the API contract: both schemes and all variants; the web resolves scheme and variant). Update DTOs with `partialWithoutDefaults` (`common/lib/zod-partial.ts`) | `services/api/src/v1/gamify/themes/theme.schema.ts`, `themes.dto.ts` | `pnpm jest src/common/authz/__tests__/update-dto-defaults.spec.ts` green; new schema spec covers valid, bad hex, 8-digit hex, out-of-range density |
| TT-02 | `contrastRatio` and `validateForPublish(theme): Issue[]` enforcing the pairs in §7.2 for both schemes and every variant override, plus atmosphere limits. Vectors: `#FFFFFF` on `#000000` = 21; every pair in §7.2 within 0.01 | `theme-validator.ts`, spec | the default theme returns zero issues; a theme with `fg` `#777777` on `bg` `#888888` returns a contrast issue |
| TT-03 | Asset policy (§115, §170): accept only `{ fileId, url }` from the upload service or an `https` URL whose host is in `THEME_ASSET_HOSTS`. Parse with `new URL`. Reject: non-https, `localhost`, private and link-local ranges (`10.`, `172.16–31.`, `192.168.`, `169.254.169.254`), `[::1]`, decimal and hex IPv4 forms (the WHATWG parser normalizes them), userinfo, non-443 ports, trailing-dot hosts, `data:`, `file:`, `javascript:`, SVG for remote images, and any declared size above 4 MB (matches `uploads.service.ts:40`). It never fetches the URL | `theme-asset-policy.ts`, spec | one test per rejected form and two accepted forms; the spec asserts the code path makes no network call |
| TT-04 | Harden the service: allow only `status`, `scope`, `q`, and `include=icons` in `findAll`; non-admins see only `PUBLISHED` and `GLOBAL`; creates always start as `DRAFT`; remove dead `toPrismaJson`; store images as `{ url }` objects | `themes.repo.ts`, `themes.service.ts`, `themes.dto.ts` | `pnpm jest src/v1/gamify` green; new spec sends an unknown query key and gets it ignored |
| TT-05 | Lifecycle intents `POST /gamify/themes/:id/{submit-review,publish,suspend,archive,set-default}` with state table `theme-state.ts` (`DRAFT`→`REVIEW`,`ARCHIVED`; `REVIEW`→`DRAFT`,`PUBLISHED`,`ARCHIVED`; `PUBLISHED`→`SUSPENDED`,`ARCHIVED`; `SUSPENDED`→`PUBLISHED`,`ARCHIVED`), modelled on `orders/order-state.ts`. Each runs in one transaction with a row lock, is idempotent, writes an `AuditService` entry. `publish` runs TT-02 and TT-03 and bumps `version`. `set-default` swaps the default atomically. `DELETE` only for an unreferenced `DRAFT` that is not the default, otherwise 409. All `@Roles(Role.ADMIN)`; there is no `PATCH status` | `theme-state.ts`, `themes.controller.ts`, `themes.service.ts`, `docs/architecture/AUTHORIZATION_MATRIX.md` | `route-access.spec.ts` green; state-table spec covers every allowed and forbidden transition; concurrency spec: two parallel `set-default` calls leave exactly one default |
| TT-06 | `GET /gamify/themes/default`, `@Public()`, declared before `:id`. Returns the default theme as a `NormalizedTheme` (both schemes and all variants, legacy fields mapped by §7.5). Headers `Cache-Control: public, max-age=60, stale-while-revalidate=300` and `ETag: "<slug>-v<version>"`, `304` on a matching `If-None-Match`. Only `PUBLISHED` and `GLOBAL` are visible. Curriculum endpoints keep `include=theme` for inherited themes | `themes.controller.ts` | HTTP-harness spec: anonymous `200`, second call with the ETag `304`, a suspended default is never served, response has no learner data |
| TT-07 | Web theme library, pure TypeScript with explicit imports (no Nuxt auto-imports) so vitest can run it: `types.ts`, `color.ts` (`parseHex`, `contrastRatio`, `withAlpha` via `color-mix`), `normalize.ts` (§7.5), `resolve.ts` (priority: accessibility, mode variant, step, lesson, sub-topic, topic, default), `css-vars.ts` (`toCssVars(resolved)` returns `--rc-*` names), `default-theme.ts` (imports the JSON), plus `reducera-ocean.theme.json`. Add vitest: `pnpm add -D vitest`, script `"test": "vitest run"`, `vitest.config.ts` with `include: ['app/**/*.test.ts']` | `apps/web/app/theme/*`, `apps/web/vitest.config.ts`, `apps/web/package.json` | `pnpm test` runs the golden tests of §9 |
| TT-08 | Sync guard `infra/scripts/check-theme-sync.sh` (`cmp` of the two JSON files, exit 1 on difference) and a test asserting the JSON validates against the TT-01 schema and passes TT-02 | `infra/scripts/check-theme-sync.sh` | script exits 0; editing one file makes it exit 1 |

`resolve.ts` signature:

```ts
export function resolveTheme(input: {
  chain: Array<RawTheme | null | undefined>
  variant: ThemeVariantKey
  scheme: 'light' | 'dark'
  reducedMotion: boolean
  fallback: NormalizedTheme
}): ResolvedTheme
```

`chain` is ordered step, lesson, sub-topic, topic; the first valid entry wins, then `fallback`. Invalid entries are skipped, never thrown.

### 8.4 Track S — server-side rendering and speed

The web app keeps `ssr: true` (`nuxt.config.ts:5`). Rules for every page from now on: meaningful content and the theme are in the first HTML response, no `Math.random()`, `Date.now()` or `window` access during render, and no page-level `swr` or `isr` on a page that renders user state (the header depends on the auth cookie, and the Nitro cache key ignores cookies, so caching would leak one user's header to another).

| ID | Task | Files | Verify |
|---|---|---|---|
| S-01 | **Server calls the internal API (BL-14).** In `runtimeConfig` add a private `apiInternalUrl` built from `API_URL_INTERNAL` plus `/api/v1` (and `aiInternalUrl` from `AI_API_INTERNAL_URL` plus `/ai/v1`); delete the unused `apiUrl: process.env.API_URL` and `aiurl`. `getApiUrl()` and `getAiApiUrl()` return the internal URL when `import.meta.server` is true, the public URL otherwise. `auth.server.ts` uses the same helper and forwards the request cookie | `apps/web/nuxt.config.ts`, `apps/web/app/lib/api.ts`, `apps/web/app/lib/ai.ts`, `apps/web/app/plugins/auth.server.ts` | With the stack up: `docker compose exec web wget -qO- http://api:3002/api/v1/categories` returns JSON; `curl -s http://localhost/ ` contains a category or topic title in the HTML (server rendered); web container logs show no `ECONNREFUSED` |
| S-02 | **No duplicate requests (BL-15).** Fetch landing data once with a stable key and hydrate it from the server payload (`useAsyncData` or the query module's SSR hydration). Share the auth state between server and client through `useState('user')` | `apps/web/app/pages/index.vue`, `components/topics/*`, `plugins/auth*.ts` | Playwright `browser_network_requests` on `/` (logged out): `auth/check` and `categories` each at most once |
| S-03 | **Theme in the first byte.** Default theme CSS is static in `main.css` (TU-02). For any non-default theme, `ThemeShell` writes an SSR `<style>` (through `useHead`) or inline `--rc-*` variables on the section wrapper. The default theme record comes from a Nitro `cachedFunction` (60 s, stale-while-revalidate) calling `GET /gamify/themes/default` with an 800 ms timeout, and falls back to the bundled JSON on timeout, error or invalid data. SSR never waits on the database | `apps/web/app/composables/useResolvedTheme.ts`, `apps/web/server/utils/theme.ts`, `apps/web/app/components/theme/ThemeShell.vue` | `curl -s http://localhost/ \| grep -c "\-\-rc-"` is at least 1; stop `api` and the page still returns 200 with the same look; unit test: a mocked fetch that takes 2 s resolves to the fallback in under 900 ms |
| S-04 | **Color scheme without flash (DC-06).** In `nuxt.config.ts`: `colorMode: { preference: 'system', fallback: 'light', storage: 'cookie', storageKey: 'rc-color-mode' }` | `apps/web/nuxt.config.ts` | `curl -s -H "Cookie: rc-color-mode=dark" http://localhost/ \| grep -o '<html[^>]*>'` shows `class="dark"` in the raw HTML |
| S-05 | **Delivery hygiene.** (a) Fix the `sharp` binary warning (BL-16): approve its build script for pnpm 11 (`pnpm approve-builds`) and commit the allow-list. (b) Preload the two critical font files (`useHead` `link rel=preload as=font crossorigin`) and remove unused font faces (DC-10). (c) `nitro.compressPublicAssets: true`. (d) `routeRules` for `/_nuxt/**` with `cache-control: public, max-age=31536000, immutable`. (e) Lazy hydration for below-the-fold sections (`<LazyFeatureSection hydrate-on-visible />`, same for the carousel). (f) Check `gzip_types` in `infra/nginx/nginx.conf` includes `image/svg+xml` and `application/json` | `apps/web/nuxt.config.ts`, `apps/web/package.json`, `apps/web/app/pages/index.vue`, `infra/nginx/nginx.conf` | `pnpm build` prints no `sharp` warning; `curl -sI http://localhost/_nuxt/<file>.css` shows the immutable header and `content-encoding: gzip` |
| S-06 | **Measure, don't guess.** With Playwright, on `/` at 1280x800 and 375x812, record before and after: navigation `responseStart` (TTFB), `domContentLoadedEventEnd`, LCP and cumulative layout shift from `PerformanceObserver` (`buffered: true`), total transferred bytes | report | Acceptance: CLS caused by theme is 0; LCP and TTFB do not regress against the pre-change run; the table is in the final report |

### 8.5 Track TU — UI

Every task ends with the Playwright matrix from `AGENTS.md`. A task that is meant to change the look also needs a before and after screenshot of the same page, viewport and scheme.

| ID | Task | Files | Verify |
|---|---|---|---|
| TU-01 | Document basics: `app.head.htmlAttrs.lang = 'id'`; two `theme-color` metas with `media="(prefers-color-scheme: light)"` (`#F2FAFB`) and `dark` (`#04202D`); a `main` landmark with `id="main"` in the layouts and `pages/index.vue`; a skip link "Lewati ke konten" that is visible on focus | `apps/web/nuxt.config.ts`, `app.vue`, `layouts/*.vue`, `pages/index.vue` | `browser_evaluate` shows `lang === 'id'`, one `main`, one `h1`, both `theme-color` metas |
| TU-02 | **Tokens.** Rewrite `main.css:4-90`: `:root` and `.dark` blocks with the `--rc-*` tokens of §7.2; the three scales of §7.3 inside `@theme static` as `--color-reef-*`, `--color-tide-*`, `--color-shell-*`; map Nuxt UI semantics (`--ui-bg`, `--ui-bg-muted`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-text`, `--ui-text-muted`, `--ui-text-dimmed`, `--ui-text-toned`, `--ui-text-highlighted`, `--ui-border`, `--ui-border-accented`) to them; delete the orange, neon success, info, warning and error variable blocks and `--ui-bg: #030014`. Move `apps/web/app.config.ts` to `apps/web/app/app.config.ts` with `ui.colors` `{ primary: 'reef', secondary: 'tide', neutral: 'shell', success: 'emerald', warning: 'amber', error: 'red', info: 'sky' }` and remove `#2e0b73` (BL-12). Set body font to Ubuntu and delete the Exo 2 and Orbitron faces once `grep -rn "font-exo2\|font-orbitron\|Orbitron\|Exo 2" apps/web/app` shows no users. Before writing, confirm the variable names against `node_modules/@nuxt/ui/dist/runtime/index.css` | `apps/web/app/assets/css/main.css`, `apps/web/app/app.config.ts` | Playwright light and dark: `browser_evaluate` body text contrast ≥ 4.5 (baseline was 2.01); primary button text ≥ 4.5 |
| TU-03 | `useResolvedTheme` composable (`app/composables/`, the directory `app/composable/` is not auto-scanned) and `ThemeShell.vue`. The shell renders a wrapper with `data-rc-theme`, `data-rc-variant`, `data-rc-motion` and inline variables from `toCssVars`. Wrap `app.vue` in it. Delete the dead `cursor-rocket` class. Reduced motion comes from `useMediaQuery('(prefers-reduced-motion: reduce)')` and the CSS media query | `apps/web/app/composables/useResolvedTheme.ts`, `components/theme/ThemeShell.vue`, `app.vue` | `pnpm test` still green; view-source of `/` has `data-rc-theme="reducera-ocean"` |
| TU-04 | `ThemeBackground.vue`: the ocean layers of §7.4, deterministic bubble parameters, motion off per the rules. Use it in `app.vue` and replace `.universe-bg` in `(auth)/{login,forgot-password,verify-email}.vue` and `components/ui/DownStarAnimation.vue`. Use `trace_path` inbound to find importers of `Blackhole.vue`, `Sunset.vue`, `Glassy.vue`, `DownStarAnimation.vue`; delete the ones with no importer and the `.universe-bg`, `panStars`, `pulseGlow`, `shooting-star` CSS | `components/theme/ThemeBackground.vue`, `assets/css/main.css`, auth pages | Playwright with `reducedMotion: reduce`: `getAnimations().length === 0` inside `[data-rc-theme]`; with default motion the count is greater than 0 on `/` and 0 in variant `EXAM` |
| TU-05 | Refactor the three raw consumers (BL-06, BL-10) to CSS variables from `useResolvedTheme(chain)`. Replace `${hex}NN` concatenation with `color-mix(in srgb, var(--rc-primary) N%, transparent)`. Replace random sizes and positions with values derived from the index. Turn the planet spheres into pearls (`ThemeWorldCard.vue`, one component). A null theme must render the default ocean | `MainSubTopics.vue`, `pages/my-learning/sub-topics/[id]/index.vue`, `pages/my-learning/lessons/[id]/index.vue` | `grep -rn 'theme?\.\(primary\|secondary\)' apps/web/app` empty; Playwright on a sub-topic with `themeId` null shows no `undefined` in any computed style; no hydration warnings in the console |
| TU-06 | **Brand assets (BL-04).** `components/brand/BrandLogo.vue`: inline SVG mark (a pearl over two wave lines, `currentColor` and tokens) plus the wordmark "ReduCera" in Ubuntu Bold. Use it in `Header.vue:12` and every other importer of `logo.svg`. Add `apps/web/scripts/build-brand-assets.mjs` (uses `sharp`) that renders `favicon.svg` (under 2 KB), `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png` and `-512x512.png` from the mark; commit the outputs. Update `site.webmanifest`: `theme_color #0B7285`, `background_color #F2FAFB`. Delete `public/pictures/logo.svg` (561 KB) and the space illustrations (`blackhole`, `bloodmoon`, `earth`, `emerald`, `mercury`, `neptune`, `saturn`) after `search_code` shows no references | `components/brand/BrandLogo.vue`, `apps/web/scripts/build-brand-assets.mjs`, `apps/web/public/*` | Screenshot of the header at 375 and 1280 reads "ReduCera"; `ls apps/web/public/pictures` no longer lists the deleted files; `pnpm build` green |
| TU-07 | Landing page for the business direction (§6): `OceanHero.vue` replaces the astronaut art; hero, chips, buttons and paragraph per §6.4; feature cards for what is live; a "Segera" strip; a loop section (Belajar → … → Belajar Lagi) with live and soon labels. Recreate the 404 page (`pages/[...all].vue`) without a star canvas | `components/landingpage/*`, `pages/index.vue`, `pages/[...all].vue` | Before and after screenshots at 375x812, 768x1024, 1280x800, light and dark, all written to `.playwright-mcp/`; nothing on screen mentions SMK, sertifikasi, guru, or a space theme |
| TU-08 | Sweep for leftover space identity and raw colors: `grep -rnE '#[0-9a-fA-F]{3,8}\b' apps/web/app --include=*.vue` and `grep -rnE '(orange|purple|violet|indigo|fuchsia)-[0-9]+' apps/web/app`. Replace with semantic classes (`text-primary`, `bg-elevated`, `text-muted`) or `var(--rc-*)`. Keep only colors that belong to data (for example a chart) and list them | `apps/web/app/**` | Both greps return only the documented exceptions |
| TU-09 | Final visual pass on: `/`, `/login`, `/register`, `/forgot-password`, `/learn/topics`, `/learn/topics/<slug>/detail`, and, after logging in as the seeded student, `/learn/profile/dashboard`, `/my-learning/topics/<slug>`, one sub-topic, one lesson, one step. Matrix: 3 viewports, both schemes, one reduced-motion run per page | `.playwright-mcp/` | The table of page, viewport, scheme, console errors, contrast, horizontal scroll, and screenshot name is in the report |

### 8.6 Track B — brand and business alignment

| ID | Task | Files | Verify |
|---|---|---|---|
| B-01 | Normalize the brand spelling: user-facing "REDUCERA" in titles and headings becomes "ReduCera" | `apps/web/nuxt.config.ts`, `pages/**`, `components/landingpage/*` | `grep -rn "REDUCERA" apps/web/app apps/web/nuxt.config.ts` returns only constants and env names |
| B-02 | Apply the copy of §6.4 and the terminology of §6.3 to every location in BL-05, and the OpenAPI examples in `services/ai-api/v1/learning/dto.py:30` and `services/api/src/v1/chat/contents/contents.dto.ts:29`. Reposition the LLM prompts from vocational certification to university accounting: `v1/users_steps/generate_quiz_pipeline.py:62-63,107` ("Professional Certification Exam Developer", "Materi Sertifikasi"), `v1/learning/content_pipeline.py:171` ("Pakar Materi Sertifikasi Profesi"). Run the quiz benchmark (`infra/scripts/llm-bench/bench_quiz.py`) before and after; answer-key accuracy must not drop. Keep the database role `TEACHER` | files in BL-05, the three prompt files | B-04 passes; quiz keys stay 5/5 |
| B-03 | Keep claims honest: every feature named in copy must be `Live` in §6.2, or carry a `Segera` badge | landing components | review against §6.2; the report lists each claim and its evidence |
| B-04 | Copy guard: a vitest that scans `apps/web/app` and `nuxt.config.ts` and fails on `SMK`, `siswa`, `BNSP`, `SKKNI`, `sertifikasi`, `Menjadi Guru`, `cervana`, `ceruana` (case-insensitive). Exclude `app/constants/index.ts` until A-02 moves the lesson text | `apps/web/app/theme/__tests__/copy.test.ts` (or `apps/web/tests/copy.test.ts`) | `pnpm test` green; reintroducing "SMK" makes it fail |
| B-05 | SEO image (DC-05): a static route `/brand/og` renders the ocean hero at 1200x630; screenshot it with Playwright into `apps/web/public/images/seo/reducera-preview.png`; delete the route or mark it `noindex` | `apps/web/app/pages/brand/og.vue`, `apps/web/public/images/seo/` | `curl -sI http://localhost/images/seo/reducera-preview.png` returns 200 `image/png`; the OG tags point at it |

### 8.7 Track TG — theme preview, generator and admin (after TU)

| ID | Task | Files | Verify |
|---|---|---|---|
| TG-01 | Deterministic proposer (no LLM, in `api`): a pure function from `{ name, context, level, mood[], keywords[], intensity }` to a draft theme. It derives a hue from the mood and keywords, builds both schemes from fixed lightness ladders, and adjusts until TT-02 passes | `services/api/src/v1/gamify/themes/theme-proposer.ts`, spec | golden cases (§9): valid, invalid color, missing fields, malformed input, oversize asset, invalid asset URL |
| TG-02 | `POST /gamify/themes/generate` (`@Roles(Role.ADMIN)`) returns a proposal without saving. Saving goes through the existing create, which stores `DRAFT` and `provenance.source = 'generator'` | `themes.controller.ts` | spec: nothing is written by `generate`; publish still needs the intent endpoint |
| TG-03 | LLM proposer in `ai-api`: `POST /ai/v1/themes/propose`, admin JWT checked with `config/user_auth.py`, prompt built with prompt segmentation, output validated by a Pydantic mirror of TT-01, never persisted. Tests use a fake chat model | `services/ai-api/v1/themes/{router,service,dto}.py`, `v1/router.py` | pytest: valid proposal `200`; malformed JSON `422`; non-admin `403`; no database access |
| TG-04 | `ThemePreview.vue` and `pages/admin/themes/index.vue` behind a role middleware (`ADMIN` only): lesson header, cards, buttons, AI panel, variant switcher. Publish is a human click that calls the intent endpoint | `apps/web/app/components/theme/ThemePreview.vue`, `pages/admin/themes/index.vue`, `middleware/` | Playwright as admin: proposal, preview in 4 variants, save draft, publish; as student the route redirects |
| TG-05 | Rollback: suspending the active default makes the API serve the previous published default or the built-in fallback | `themes.service.ts` | spec: `set-default` to B, suspend B, `GET /default` returns A (or `404` and the web uses the bundled JSON) |

### 8.8 Track A — accounting and learning phases (master prompt phases 1–14)

Statuses use the labels of `docs/STYLE-GUIDE.md`. Details live in the linked architecture documents; each task needs its own audit step before code.

| Phase | Status now | Evidence | First tasks | Exit gate |
|---|---|---|---|---|
| 1 Security | partial | `route-access.spec.ts`, internal signature, tenants, prompt segmentation (24 tests pass), URL allowlist in `ai-api`; boundary violation removed (P-05) | TT-03 theme assets; memory poisoning and reward-farming tests | listed security tests of §169 exist and pass |
| 2 Accounting foundation | scaffolded | curriculum tables exist; no prerequisites; vocational seed | **A-01** `SubTopicPrerequisite(subTopicId, requiresId)` with unique pair, no self edge, cycle check in the service. **A-02** seed the golden graph (Fundamentals → Equation → Account types → Debit/Credit → Double entry → Journal → Ledger → Trial balance → Adjusting → Adjusted trial balance → Financial statements), move SKKNI content out of `constants/index.ts`. **A-03** `AccountingContext` boundary: domain code in one module, generic core knows nothing about it (§192 test) | graph is structured and acyclic; golden architecture test answered in the report |
| 3 Learning engine | partial | `TopicMasteryRecord`, `StepMasteryRecord`, `Misconception` models; only `topic-mastery-backfill.service.ts` and a controller exist | **A-04** quiz evaluator, mastery update, misconception detection, adaptive policy, events (`docs/plans/phased-roadmap.md` phases 3–5) | learner golden tests of §166 |
| 4 Theme | planned | this plan | TD, TT, S, TU, TG | theme golden tests of §167 and the final theme test of §218 |
| 5 Personalized accounting AI | partial | chat pipeline exists, domain-generic | **A-05** tutor endpoint with explicit `domain=accounting`, learner context, memory, theme presentation hints only | decision trace stored; hints never alter facts |
| 6 Accounting sandbox | planned | `docs/architecture/accounting-sandbox.md` only | **A-06** tables `ChartOfAccounts`, `SandboxAccount`, `SandboxPeriod`, `SandboxScenario`, `SandboxTransaction`, `JournalEntry`, `JournalLine`, `LedgerEntry`, `AdjustingEntry`, `SandboxAttempt`; deterministic engine (debit equals credit, closed periods reject, posted entries immutable, reversal references the original); no foreign key to commerce tables | accounting golden tests of §165 |
| 7 Marketplace | partial | `Article`, `ClassProduct` models, `marketplace/content-state.ts`; no web screens | **A-07** discovery and creator screens | entitlement-gated content works end to end |
| 8 Commerce | partial | orders, payments, entitlements, ledger modules and tests; manual payment adapter | verify with the full stack and payment flow test | `payment-flow.int.spec.ts` on a scratch database |
| 9 Creator economy | partial | `CreatorEarning`, `Wallet`, payouts, refunds modules | **A-09** creator and wallet screens | financial invariants of §80–§88 |
| 10 AI credits | scaffolded | schema models only, no module | **A-10** package, wallet, ledger, reserve, settle, idempotency | concurrent-spend test, no negative balance |
| 11–12 Circular economy | planned | — | connect 6–10 | circularity e2e of §171 |
| 13 Agent marketplace | planned | `docs/architecture/ai-agent-marketplace.md` | one accounting agent after 5, 6 and safety | tool permission and budget tests |
| 14 Self-improvement | planned | `docs/plans/self-improving-llm.md`, `dspy-integration.md` | only after a frozen benchmark | gate, canary, rollback |

### 8.9 Track Q — quality gates and documents

| ID | Task | Files | Verify |
|---|---|---|---|
| Q-01 | Write `docs/architecture/accounting-theme-system.md` and `docs/architecture/theme-generator.md` following `docs/STYLE-GUIDE.md` (architecture template, evidence citations) and the required contents of §212 (conceptual model, schema mapping, inheritance, variants, atmosphere, mood, assets, preview, generator, validation, accessibility, performance, lifecycle, security, fallback) | `docs/architecture/` | documents link to code by `file:line` |
| Q-02 | Repair stale links: `docs/README.md` and `docs/progress-tracker.md` still point at `01-audit`, `02-architecture`, `03-plans`, `04-operations`; the folders are `audit/`, `architecture/`, `plans/`, `operations/`. Add this plan to the index | `docs/README.md`, `docs/progress-tracker.md` | a link check script or `grep -rn "0[1-4]-" docs` shows no dead targets |
| Q-03 | Python test hygiene: add `addopts = "--import-mode=importlib"` to `pyproject.toml`; investigate the five failing tests of BL-19 and either fix them or record the root cause in `docs/architecture/PHASE_1_REPORT.md`. Never delete a test to get green | `services/ai-api/pyproject.toml` | `uv run pytest -q` in one process collects all three directories |
| Q-04 | One verification entry point `infra/scripts/verify.sh` (no comments): both `docker compose config -q`, `check-theme-sync.sh`, api `pnpm jest` and `pnpm build` with a placeholder `DATABASE_URL`, web `pnpm test` and `pnpm build`, ai-api light pytest, and the detection greps of `AGENTS.md` | `infra/scripts/verify.sh` | exits 0 on a clean tree; exits non-zero when a step fails |
| Q-05 | Final report in the format of §13 | — | every item has a status and evidence |
| Q-06 | Re-run the model benchmark (`infra/scripts/llm-bench/`) whenever `OPENAI_MODEL_FLASH` or `OPENAI_MODEL_THINKING` changes, after the gateway key works, and record the table in §3.4. Also measure `reasoning_effort` and per-quiz token cost, which were blocked | `infra/scripts/llm-bench/*` | new table committed with the date |

---

## 9. Golden test map

| Master prompt test | Where | Task |
|---|---|---|
| Theme golden 1 Theme resolves from Topic | `app/theme/__tests__/resolve.test.ts` | TT-07 |
| 2 Child lesson inherits the parent theme | same | TT-07 |
| 3 Step can override the theme | same | TT-07 |
| 4 `PRACTICE` variant resolves | same | TT-07 |
| 5 `EXAM` reduces decorative complexity (density 0, no waves, no caustics) | same | TT-07 |
| 6 Missing theme falls back safely (null chain, invalid entries, thrown data) | same | TT-07 |
| 7 Invalid token is rejected (`normalize` drops it; API validator returns an issue) | `normalize.test.ts`, `theme-validator.spec.ts` | TT-02, TT-07 |
| 8 Reduced motion disables animation | `resolve.test.ts` plus Playwright `getAnimations()` | TT-07, TU-04 |
| 9 Theme does not change mastery | api spec: mastery services do not import `themes/*`; `search_code` proof in the report | TT-05 |
| 10 Theme does not change accounting validation | same for the sandbox engine | A-06 |
| Generator golden: valid, malformed AI JSON, invalid color, invalid asset URL, oversize asset, missing fields, preview, draft creation, publish approval, rollback | `theme-proposer.spec.ts`, `test_themes.py`, Playwright | TG-01..TG-05 |
| Theme asset security: localhost, internal ranges, metadata service, protocol, size, format | `theme-asset-policy.spec.ts` | TT-03 |
| Final golden test §218: theme off does not break learning; AI cannot publish; theme cannot change validation or mastery | report with evidence | TG, A |
| SSR: theme present in first HTML, default served when API is down, cookie color scheme in raw HTML | `curl` and unit tests | S-03, S-04 |

## 10. Acceptance criteria

1. `infra/scripts/verify.sh` exits 0.
2. Migration `theme_foundation` applies on a clean database and on a copy of `reducera_phase3_clean`; `migrate diff` is empty; deleting a theme no longer deletes curriculum.
3. `GET /api/v1/gamify/themes/default` works anonymously, returns `ETag`, and answers `304` on a repeat.
4. With `api` stopped, the web app still renders the ocean theme with status 200.
5. First HTML response contains the theme variables, `lang="id"`, a `main` landmark, and, with a cookie, the right color scheme class.
6. Body text contrast is at least 4.5:1 in both schemes on every page of TU-09; focus ring visible; zero console errors with the full stack; no horizontal scroll at 375 px.
7. The UI visibly changed: header logo reads "ReduCera"; no astronaut, star field or planet artwork remains; before and after screenshots are attached for the landing page and one learning page.
8. No banned copy term remains (B-04 passes); every claim in copy matches §6.2.
9. Theme layer golden tests pass (`pnpm test` in `apps/web`, `pnpm jest` in `services/api`).
10. SSR metrics recorded before and after (S-06) with no regression.
11. Detection greps in `AGENTS.md` return nothing; `route-access.spec.ts` green.

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Changing the embedding model invalidates stored vectors | High | DC-02, DC-03; `ai-api` refuses to start on a size mismatch; re-embed job before switching production |
| The Flaz key was blocked by the gateway after the benchmark (`401 Key is blocked`), so live LLM paths are unverified | High | Owner unblocks or replaces the key and sets a per-key budget cap in the Flaz dashboard; R-03 marks LLM checks `BLOCKED` until then; mock tests cover the wiring |
| The Flaz key appeared in a chat transcript and once in a command log | Medium | Rotate it after the block is resolved; use a budget-capped key |
| The developer `HF_TOKEN` was pasted into a chat and lives in `.env` | Medium | Revoke it when development ends; it is not in any tracked file |
| Theme migration touches four foreign keys | Medium | Additive, tested on a clean and a populated database; rollback below |
| Caching pages with user state leaks data across users | High | Rule in §8.4: no `swr` or `isr` on such pages; only the theme payload is cached |
| Large deletions of old assets and components | Medium | Delete only after `trace_path` and `grep` show no importer; list deletions in the report |
| Copy over-promises features that are not built | Medium | §6.2, B-03, B-04 |
| Cheap-model drift from the design | Medium | Small tasks, verify steps, golden tests, `check-theme-sync.sh` |
| `@nuxt/ui` variable names differ from §8.5 TU-02 | Low | Task starts by confirming names in `node_modules/@nuxt/ui/dist/runtime/index.css` |

## 12. Rollback

- **Code**: the owner holds the commits; revert the offending commit. The executor never runs git write commands.
- **Migration `theme_foundation`**: applied migrations are not edited. Roll forward with a new migration that drops the new columns, indexes and constraints. Do not restore `ON DELETE CASCADE` on the curriculum foreign keys.
- **Theme in production**: `POST /gamify/themes/:id/suspend` removes a bad default; the API and the web fall back to the previous default or the bundled JSON.
- **AI providers**: revert `docker-compose*.yml` and `.env` values; vectors written under a new collection name do not affect the old collection.
- **Database rename**: `cervana_postgres_data` and `cervana_redis_data` volumes are kept until R-05, so the old stack can be started from them.

## 13. Final report format

Answer in this order, each item with `DONE`, `PARTIAL`, `BLOCKED` or `NOT STARTED` and evidence (command and result, or `file:line`): 1 Executive summary, 2 Current state, 3 Accounting coupling, 4 Theme coupling, 5 Architecture before, 6 Architecture after, 7 Learning core, 8 Accounting domain, 9 Theme system, 10 Theme generator, 11 Database changes, 12 Migrations, 13 API changes, 14 AI changes, 15 RAG changes, 16 Memory changes, 17 Sandbox changes, 18 Marketplace changes, 19 Commerce changes, 20 Creator economy, 21 AI credits, 22 Frontend, 23 Security, 24 Accessibility, 25 Performance and SSR, 26 Tests, 27 Circular economy e2e, 28 Theme e2e, 29 Known issues, 30 Technical debt, 31 Files changed, 32 Commands executed, 33 Future extension path. Add the before and after screenshot list and the SSR metrics table.
