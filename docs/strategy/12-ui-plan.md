# UI System Plan

> **Status**: `planned` · **Owner**: `ux-architect` · **Last reviewed**: `2026-10-02`
>
> One Nuxt 4 app that serves learner, creator, reviewer and admin through role-aware layouts on the existing theme layer, with a validated route map, specs for the top 20 screens, a component inventory, six step-by-step flows, fixes to the current pages, and performance budgets as parameters.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD); API paths: [`11-api-plan.md`](./11-api-plan.md). Copy examples are Indonesian and avoid the banned list (SMK, BNSP, SKKNI, sertifikasi, siswa, Menjadi Guru, cervana, ceruana, Industri 4.0, sertifikat kompetensi; `copy.test.ts`). Segment: D-01 A [ASSUMPTION].

---

## 1. Principles

| Principle | Rule |
|---|---|
| One app, role-aware layouts | `public`, `auth`, `learner` (default, `layouts/learn.vue`), `studio`, `admin`; the review screens use the studio layout with a capability check. The backend stays authoritative; guards in the UI are for experience only |
| Route meta | `requiresRole`, `requiresTenantRole`, `requiresCapability`; `middleware/auth.global.ts` reads them (today it only separates signed-in from public: `auth.global.ts:8-35`) |
| Tenant | A tenant switcher sets `x-tenant-id` for `TEACHER` users with several memberships; the server still validates it (ADR-001) |
| State | TanStack Query for server state (`@peterbud/nuxt-query`, installed); one key convention `[resource, scope, params]`, for example `['orders','list',{status}]`; invalidation from SSE events named `Aggregate.EventType`; Pinia only for session, tenant and UI state; no optimistic update on money or credits |
| Rendering | SSR for public and marketplace pages (SEO, Open Graph); client-heavy editors (studio, sandbox grid) inside `<ClientOnly>` with a server-rendered shell; the rules in `AGENTS.md` "Web Rendering Rules" apply (internal URLs on the server, no `Math.random()` during render) |
| Design layer | Nuxt UI with the `reef`, `tide`, `shell` scales and `--rc-*` tokens inside `ThemeShell`; Indonesian copy; WCAG 2.2 AA; mobile first at 375 px |
| API access | Every call goes through the shared request helper (`app/lib/api.ts`, `app/services/*`); no raw `$fetch` with a hard-coded path (VD VF-20) |
| AI UX | Show the credit cost before any paid AI action; label AI-generated text; show citations; make the split visible where grading happens; clear refusal, timeout and insufficient-credit states |

AI split wording, proposed: "Dijawab oleh AI." beside explanations and "Nilai dihitung oleh sistem akuntansi." beside any score. Final wording is an owner decision (copy review).

---

## 2. Route map

Existing paths are kept; `/orders` of the master prompt maps to the existing `/learn/orders`. Status: `exists`, `change`, `new`. Layout names: P public, A auth, L learner, S studio, M admin.

| Route | Layout | Actor | Purpose | Main endpoints | Status |
|---|---|---|---|---|---|
| `/` | P | all | Landing with `OceanHero` | `GET /marketplace/products` | exists |
| `/login`, `/register`, `/forgot-password`, `/verify-email` | A | anonymous | Auth; age gate if D-02 | `/auth/*` | exists, extend |
| `/onboarding` | L | `STUDENT` | Goal, level, diagnostic | `/diagnostics`, `/me/learner-model` | new |
| `/learn/profile/dashboard` | L | `STUDENT` | Dashboard: next activity, streak, mastery (signed-in home; middleware redirects here) | `/me/next-activity`, `/gamification/me` | change |
| `/learn/path` | L | `STUDENT` | Skill tree from the prerequisite graph | `/me/skill-tree`, `/curriculum/topics/:id/graph` | new |
| `/learn/topics`, `/learn/topics/search`, `/learn/topics/[identifier]/detail` | P or L | all | Topic catalog and detail | `/curriculum/topics` | exists |
| `/learn/topics/[identifier]/order` | L | `STUDENT` | Legacy topic checkout | `/orders` | exists, remove after D-16 |
| `/learn/orders`, `/learn/orders/[id]/pay`, `/learn/orders/[id]/submitted` | L | buyer | Orders, instructions, proof upload, status | `/orders`, `/payments/*` | change (VD VF-20) |
| `/my-learning/topics/[slug]`, `/sub-topics/[id]`, `/lessons/[id]`, `/steps`, `/steps/[id]/[userStepId]` | L | `STUDENT` | Lesson and chat tutor | curriculum, learning, chat, SSE | exists |
| `/learn/achievements`, `/leaderboard`, `/streaks`, `/support` | L | `STUDENT` | Gamification pages (route group `(gamify)`) | `/gamification/*` | change |
| `/sandbox`, `/sandbox/[scenarioId]`, `/sandbox/attempts/[id]` | L | `STUDENT` | Scenario list, journal workspace, trial balance, feedback | `/sandbox/*` | new |
| `/tutor`, `/tutor/[sessionId]` | L | `STUDENT` | AI tutor with credit cost | `/tutor/sessions/*` | new |
| `/credits` | L | signed-in | Balance, packages, ledger | `/credits/*`, `/orders` | new |
| `/portfolio`, `/u/[handle]` | L, P | owner, public | Badges and verified work (D-03) | portfolio endpoints | new, stage 7 |
| `/marketplace`, `/marketplace/articles/[slug]`, `/marketplace/classes/[slug]` | P | all | Browse and detail; the param is a slug while the API route takes an id | `/marketplace/*` | change |
| `/marketplace/agents`, `/marketplace/agents/[slug]` | P | all | Agent cards with permissions and evaluation | `/marketplace/agents` | new, stage 7 |
| `/creators/[handle]` | P | all | Creator profile and products | `/creators/:handle` | new |
| `/become-creator` | L | `STUDENT` | Application with evidence (no banned copy) | `/teacher/applications` | new |
| `/studio` | S | `TEACHER` with tenant | Drafts, sales, earnings overview | `/creator-analytics/*`, `/earnings` | new (`/marketplace/creator` today) |
| `/studio/articles`, `/studio/articles/[id]` | S | `TEACHER` | Editor, versions, submit | `/articles/*` | new |
| `/studio/classes`, `/studio/classes/[id]` | S | `TEACHER` | Sessions, capacity, materials | `/classes/*` | new |
| `/studio/scenarios` | S | `TEACHER` | Scenario authoring with engine validation | `/scenarios/*` | new, stage 5 |
| `/studio/agents` | S | `TEACHER` | Agent builder and sandbox runs | `/agents/*` | new, stage 7 |
| `/studio/earnings`, `/studio/payouts`, `/studio/settings` | S | tenant `OWNER`, `MANAGER` | Earnings, wallet, payout, payout destination | `/earnings`, `/wallets/*`, `/payouts`, `/tenants/current/settings/payout` | new (`/marketplace/creator/earnings` today) |
| `/review` | S | reviewer capability | Review queue | `/review/*` | new |
| `/admin`, `/admin/payments`, `/payouts`, `/refunds`, `/teacher-applications`, `/tenants`, `/users`, `/moderation`, `/agents`, `/themes`, `/optimization`, `/audit` | M | `ADMIN` | Operations | admin endpoints | new |

### 2.1 Guards and default states

Every route carries meta that the global middleware reads; the server enforces the same rule.

| Layout and actor | Meta | Redirect when unmet |
|---|---|---|
| P public | none | none |
| A auth | `guestOnly` for login and register | `/learn/profile/dashboard` |
| L learner | signed in | `/login` |
| S studio | `requiresRole: TEACHER`, `requiresTenantRole: OWNER, MANAGER, TEACHER or EDITOR` (earnings and payouts: `OWNER` or `MANAGER`) | `ForbiddenState` |
| Review | `requiresCapability: REVIEWER` or role `ADMIN` | `ForbiddenState` |
| M admin | `requiresRole: ADMIN` | `ForbiddenState` |

Every route renders five default states with the shared components: loading (skeleton), empty (`EmptyState`), error (message with retry), forbidden (`ForbiddenState`) and, on routes that spend credits, insufficient credits (link to `/credits`). Routes outside the top 20 use this set; only exceptions are listed in §3.

---

## 3. Top 20 screens

Screen IDs `SC-nn`. Table A states purpose, guard, data and stage; table B states components, states, copy, accessibility and the Playwright acceptance. Every Playwright acceptance includes the shared matrix: 375x812, 768x1024, 1280x800; light and dark; reduced motion once; zero console errors; no horizontal scroll; `lang`, one `main`, one `h1`; contrast at least 4.5:1 for body text.

### 3.1 Table A

| ID | Screen and route | Purpose | Actor and guard | Data and endpoints | SSE | Stage |
|---|---|---|---|---|---|---|
| SC-01 | Landing `/` | Explain the product, mark live and planned features | public | `GET /marketplace/products` (cached payload) | none | 0 |
| SC-02 | Register and login | Create or enter an account, age gate if D-02 | anonymous | `/auth/*` | none | 1 |
| SC-03 | Onboarding `/onboarding` | Set goal and level, take the diagnostic | `STUDENT` | `/diagnostics`, `/diagnostics/:id/submit` | none | 1 |
| SC-04 | Dashboard `/learn/profile/dashboard` | Show next activity, streak, mastery | `STUDENT` | `/me/next-activity`, `/gamification/me` | `StreakHistory.*` | 1 |
| SC-05 | Skill tree `/learn/path` | Show nodes and states | `STUDENT` | `/me/skill-tree` | none | 1 |
| SC-06 | Lesson `/my-learning/lessons/[id]` | Read and ask the tutor | `STUDENT` plus entitlement or free | curriculum, chat | chat messages stream | 0 |
| SC-07 | Scenario list `/sandbox` | Pick a scenario by level and prerequisite | `STUDENT` | `/sandbox/scenarios` | none | 1 |
| SC-08 | Journal workspace `/sandbox/attempts/[id]` | Enter, validate, post, see trial balance and feedback | attempt owner | `/sandbox/attempts/*` | none | 1 |
| SC-09 | Tutor `/tutor/[sessionId]` | Ask with a visible credit cost | `STUDENT` | `/tutor/sessions/*`, `/credits/me` | `Tutor.Answered` | 4 |
| SC-10 | Credits `/credits` | Balance, packages, ledger | signed-in | `/credits/*`, `/orders` | `Credit.*` | 4 |
| SC-11 | Marketplace `/marketplace` | Browse products | public | `/marketplace/products` | none | 2 |
| SC-12 | Product detail `/marketplace/articles/[slug]` and classes | Decide and buy | public; buy needs sign-in | `/marketplace/*` | none | 2 |
| SC-13 | Pay `/learn/orders/[id]/pay` | Choose method, see instructions, upload proof | buyer | `/orders/:id`, `/payments/methods`, `/payments/manual/intents/:id/submissions`, `/uploads` | `Payment.*` | 0 |
| SC-14 | Orders `/learn/orders` | Status timeline, refund request | buyer | `/orders`, `/orders/:id/refund-requests` | `Payment.*`, `Order.*` | 2 |
| SC-15 | Become creator `/become-creator` | Apply with evidence | `STUDENT` | `/teacher/applications` | none | 2 |
| SC-16 | Studio `/studio` | Drafts, sales, earnings overview | `TEACHER` with tenant | `/creator-analytics/:id/*`, `/earnings` | `Order.*` | 2 |
| SC-17 | Article editor `/studio/articles/[id]` | Write, version, submit | tenant `EDITOR` and above | `/articles/*` | none | 2 |
| SC-18 | Review `/review` | Decide on submitted items | reviewer capability, not the author | `/review/*` | `Review.*` | 2 |
| SC-19 | Earnings and payouts `/studio/earnings`, `/studio/payouts` | See funds, request payout | tenant `OWNER`, `MANAGER` | `/wallets/*`, `/payouts` | `Payout.*` | 3 |
| SC-20 | Admin payments `/admin/payments` | Review proofs | `ADMIN` | `/admin/payments/manual/submissions*` | `Payment.*` | 2 |

### 3.2 Table B

| ID | Components | States beyond the happy path | Copy keys (examples) | Accessibility | Playwright assertions |
|---|---|---|---|---|---|
| SC-01 | `OceanHero`, `BrandLogo`, `FeatureSection` with a "Segera" badge on planned items | loading skeleton, empty product strip, error banner | `landing.hero.cta` "Mulai Belajar"; `landing.soon` "Segera" | one `h1`, skip link "Lewati ke konten" | first HTML contains the theme variables and the title; no banned term |
| SC-02 | `FormLogin`, `FormRegister`, age field (D-02) | invalid code, locked | `auth.register.title` "Buat akun" | labels, error text linked by `aria-describedby` | wrong password shows a message, focus moves to it |
| SC-03 | `NextActivityCard`, quiz modal | forbidden if not signed in, resume a half-finished diagnostic | `onboarding.start` "Cek level awalmu" | keyboard-operable options | finishing places the learner on a node |
| SC-04 | `NextActivityCard`, `MasteryMeter`, `StreakIndicator` | no mastery yet, forbidden, error | `dash.next` "Lanjut belajar" | meter has text value | card links to a real activity |
| SC-05 | `SkillTreeGraph`, `MasteryMeter` | empty graph, locked node tooltip | `path.locked` "Selesaikan {topik} dulu" | tree is a list in DOM order; no hover-only content | locked node is not focusable as a link |
| SC-06 | `Chatbot`, `CitationList`, `RenderMarkdown` | not entitled (`ENTITLEMENT_REQUIRED`), no material found | `lesson.locked` "Materi ini perlu dibeli" | live region for streamed text | AI text carries the AI label |
| SC-07 | scenario cards with level and prerequisites | empty, forbidden | `sandbox.empty` "Belum ada skenario untuk levelmu" | cards are links | filter by level works |
| SC-08 | `JournalEntryGrid`, `TrialBalanceTable`, `ScenarioEventCard`, `MisconceptionHint` | `PERIOD_CLOSED`, `JOURNAL_UNBALANCED` with line marks, attempt completed | `sandbox.unbalanced` "Debit dan kredit belum sama"; disclaimer "Simulasi untuk belajar; bukan nasihat akuntansi profesional." | live debit and credit totals in a status region; no drag-only action; target size 24 px | unbalanced post shows the engine error on the right line; trial balance matches the expected one |
| SC-09 | `CreditCostConfirm`, `CitationList`, AI label | `INSUFFICIENT_AI_CREDITS`, `LLM_UNAVAILABLE`, `GROUNDING_EMPTY`, timeout | `tutor.cost` "Pertanyaan ini memakai {n} kredit"; `tutor.empty` "Materi tidak ditemukan" | confirm dialog traps focus | cost appears before send; balance falls only after settle |
| SC-10 | `CreditBalancePill`, package cards, ledger table | empty ledger, order pending | `credits.buy` "Beli kredit" | table headers scoped | purchase goes through the order pipeline |
| SC-11 | `ProductCard`, filters | empty result, error | `market.empty` "Belum ada produk" | filter form labeled | a published product from an active tenant appears |
| SC-12 | `PriceTag`, review status, `ProvenanceList` | not published, entitlement held, already owned | `product.owned` "Sudah kamu miliki" | price read as text with currency | price shows the currency and two decimals |
| SC-13 | `PaymentInstructionPanel`, `ProofUpload`, `OrderStatusTimeline` | `PAYMENT_EXPIRED`, `PAYMENT_PROVIDER_UNAVAILABLE`, proof rejected | `pay.proof` "Unggah bukti transfer" | upload has a text alternative to drag | proof upload succeeds and status becomes submitted |
| SC-14 | `OrderStatusTimeline` | empty, refund window closed | `orders.refund` "Ajukan pengembalian dana" | timeline is an ordered list | list shows the new order |
| SC-15 | evidence upload, mastery snapshot | already applied, pending, rejected with note | `creator.apply` "Jadi Kreator" | form errors linked | pending application blocks a second one |
| SC-16 | `EmptyState`, sales cards | no tenant, suspended tenant | `studio.empty` "Belum ada draf" | landmarks per section | non-creator gets `ForbiddenState` |
| SC-17 | editor in `<ClientOnly>`, version list | `CONTENT_LOCKED`, `VERSION_CONFLICT`, unsaved changes | `editor.conflict` "Draf ini diubah di tab lain" | editor toolbar keyboard reachable | second tab edit shows the conflict |
| SC-18 | `ReviewQueueTable`, `AuditTrailDrawer` | author cannot review (`REVIEW_CONFLICT_OF_INTEREST`), empty queue | `review.approve` "Setujui" | table sortable by keyboard | own item action is disabled |
| SC-19 | `PriceTag`, ledger table, payout form | `PAYOUT_EXCEEDS_BALANCE`, tenant not active, no destination | `payout.request` "Ajukan penarikan" | amounts as text | request holds funds and shows pending |
| SC-20 | `ReviewQueueTable`, proof viewer, reason dialog | another admin in review, proof missing | `admin.pay.approve` "Setujui pembayaran" | dialog focus trap | approve moves the order to fulfilled |

---

## 4. Component inventory

| Group | Component | Status | Used by |
|---|---|---|---|
| Existing | `ThemeShell`, `BrandLogo`, `OceanHero`, `Chatbot`, `PersonalityQuiz`, `LearningStyleForm`, `RenderMarkdown`, `SidebarLogin`, `Header`, `Footer` | exists | all |
| Learning | `SkillTreeGraph`, `MasteryMeter`, `NextActivityCard`, `JournalEntryGrid` (live totals, engine errors per line), `TrialBalanceTable`, `ScenarioEventCard`, `MisconceptionHint`, `CitationList`, `StreakIndicator`, `RewardToast` | new | SC-03 to SC-09 |
| Commerce | `ProductCard` and a separate `AgentCard`, `PriceTag` (Decimal and IDR), `PaymentInstructionPanel`, `ProofUpload`, `OrderStatusTimeline`, `CreditBalancePill`, `CreditCostConfirm` | new | SC-09 to SC-14, SC-19 |
| Operations | `ReviewQueueTable`, `AuditTrailDrawer`, `TenantSwitcher`, `EmptyState`, `ForbiddenState` | new | SC-16 to SC-20 |
| Provenance | `ProvenanceList` | new | SC-12, stage 5 |

---

## 5. Key flows

Each flow lists the steps and every state a screen can show.

### 5.1 First session to first balanced entry (stage 1)

1. `/register` with age field if D-02. Error: duplicate email, invalid code. Next: `/verify-email`.
2. `/onboarding`: goal, level, diagnostic of a few items. Loading skeleton while the attempt starts; error with retry; saved progress on reload.
3. `/learn/profile/dashboard`: one `NextActivityCard` pointing to scenario 1, a `MasteryMeter`, no streak yet. Empty state until scenarios are seeded.
4. `/sandbox/[scenarioId]`: event card with the narrative, the chart as a list, the disclaimer.
5. `/sandbox/attempts/[id]`: `JournalEntryGrid` with two empty lines; totals update as lines change; "Periksa" validates; a line-level message for each engine error; "Posting" is enabled only when valid.
6. After posting, the trial balance shows; "Selesai" computes the score; `MisconceptionHint` lists tags with the rule text; AI offers an explanation labeled as AI.

### 5.2 Checkout with manual transfer (stage 0 and 2)

1. `/marketplace/articles/[slug]`: `PriceTag`, "Beli" for a signed-in user, sign-in prompt otherwise; owned product shows "Sudah kamu miliki".
2. `POST /orders`: button disabled while pending; errors `ALREADY_OWNED`, `PAYMENT_PROVIDER_UNAVAILABLE` (show "Metode pembayaran belum tersedia").
3. `/learn/orders/[id]/pay`: `PaymentInstructionPanel` with bank and amount; expiry time; `ProofUpload` with a reference number; errors: expired, upload failed.
4. `/learn/orders/[id]/submitted`: status "Menunggu verifikasi"; timeline; SSE updates it.
5. On approval the timeline shows paid and fulfilled, and the product page shows access; on rejection the page shows the reason and a resubmit action up to the limit.

### 5.3 Studio publish through review (stage 2)

1. `/studio/articles`: list with status chips; empty state with "Tulis artikel".
2. `/studio/articles/[id]`: editor in `<ClientOnly>`; autosave of drafts with `If-Match`; `VERSION_CONFLICT` shows a merge prompt; versions drawer.
3. "Ajukan tinjauan": validators run; a list of issues blocks submission; success moves to `PENDING_REVIEW` and locks editing (`CONTENT_LOCKED`).
4. `/review`: reviewer claims, reads version and checks; approve, reject with note, or request changes; the author sees the note.
5. Approved: listed in the marketplace; rejected: back to editable with the note.

### 5.4 Payout request (stage 3)

1. `/studio/settings`: payout destination form; empty state blocks payout until set.
2. `/studio/earnings`: wallet balance, pending earnings with release dates, ledger.
3. `/studio/payouts`: amount field with minimum; errors `PAYOUT_EXCEEDS_BALANCE`, tenant not active; confirm dialog states that funds are held.
4. Status page: requested, under review, approved, paid with evidence, or rejected with reason and funds returned; cancel while requested.

### 5.5 Admin payment review (stage 2)

1. `/admin/payments`: queue oldest first, filter by status; another admin's claimed item is marked.
2. Detail: proof image, amount, reference, order summary; "Mulai tinjau" locks the item.
3. Approve or reject with a required reason; reject offers "izinkan unggah ulang". Errors: already reviewed (`PAYMENT_ALREADY_REVIEWED`).
4. After approval the row shows fulfilled; the audit drawer lists the entries.

### 5.6 Tutor message with credit reservation (stage 4)

1. `/tutor/[sessionId]`: composer shows the estimated cost; `CreditBalancePill` shows balance.
2. "Kirim": `CreditCostConfirm` appears on first use per session; no optimistic balance change.
3. Streaming answer with AI label and citations; on completion the pill updates from the settled value.
4. States: `INSUFFICIENT_AI_CREDITS` shows a "Beli kredit" link; `LLM_UNAVAILABLE` shows retry and states that nothing was charged; `GROUNDING_EMPTY` shows "Materi tidak ditemukan" with no charge; timeout releases the reservation.

---

## 6. Fixes to the existing web

| Fix | Evidence | Stage |
|---|---|---|
| Replace 14 raw `$fetch('/v1/...')` calls with the shared request helper and real routes | VD VF-20 | 0 |
| Make `pay.vue` use `GET /payments/methods` and `POST /payments/manual/intents/:id/submissions`; create the intent through `POST /orders` | VD VF-20 | 0 |
| Resolve slug versus id on the marketplace detail pages | VD VF-20 | 0 |
| Fix `navigateTo('/app//topics')` | `pages/my-learning/steps.vue:29` | 0 |
| Role-aware middleware and layouts, `requiresRole` meta | `auth.global.ts` | 2 |
| Auto-import landing components (in progress in the working tree) | `nuxt.config.ts` diff, `docs/superpowers/plans/2026-10-01-autoimport-fix-plan.md` | 0 |
| Remove `Blackhole`, `Sunset`, `Glassy`, `DownStarAnimation` and `Math.random` in render | VD §7 TU-04, TU-05 | 0 |
| Uppercase `REDUCERA` in `login.vue:13`, `register.vue:9`; add "Segera" labels | VD VF-12, B-03 | 0 |
| Absolute `og:image` URL | `nuxt.config.ts` `og:image` is relative | 0 |

---

## 7. Performance budgets

Budgets are parameters; no value is set before a baseline exists (S-06 has not run).

| Route class | JS per route (gzip) | LCP target | CLS target | Interaction target |
|---|---|---|---|---|
| Public SSR (`/`, marketplace) | `J_pub` | `T_lcp_pub` | `C_max` | `T_inp` |
| Learner (dashboard, lesson, sandbox) | `J_lrn` | `T_lcp_lrn` | `C_max` | `T_inp` |
| Studio and admin | `J_stu` | `T_lcp_stu` | `C_max` | `T_inp` |

Measurement: Playwright `PerformanceObserver` with `buffered: true` for LCP and layout shift on `/` at 1280x800 and 375x812 before and after each change (the S-06 method), `nuxt build --analyze` for JS per route, response `Server-Timing` for TTFB; the report holds a table of page, viewport, scheme, LCP, CLS, transfer bytes. The theme must not cause layout shift (target 0).

## 8. Acceptance criteria

| Criterion | Test |
|---|---|
| Every route in §2 has an actor, guard, endpoints and states | Review of §2 and §3 |
| Every copy example passes the banned list | `copy.test.ts` extended to the studio and admin trees |
| Every screen passes the shared Playwright matrix | Playwright run per stage, screenshots under `.playwright-mcp/` |
| Direct API calls bypass nothing | `grep -rnF '$fetch(' apps/web/app/pages` returns no `/v1/` path |
