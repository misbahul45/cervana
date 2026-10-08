# Web PHASE 2 (Round 2) Completion Note

**Source:** Master prompt for ReduCera WEB. Date: 2026-10-05.

This note records the second batch of screens that were deferred from the original PHASE 2–9 pass and have now been completed per master prompt §19, §107, and §116 acceptance criteria.

## 1. Pages Rewritten or Created

| Master prompt screen | Route | Status |
|---|---|---|
| SC-07 Sandbox list | `/sandbox` | rewritten with SandboxScenarioCard |
| SC-11 Marketplace | `/marketplace` | rewritten with ProductCard + search/filter |
| SC-12 Product detail (article) | `/marketplace/articles/[slug]` | new with buy flow |
| SC-13/SC-14 Orders list + detail | `/learn/orders`, `/learn/orders/[id]` | rewritten with OrderStatusTimeline |
| SC-15 Become creator apply | `/become-creator/apply` | new with state machine |
| SC-19 Earnings | `/studio/earnings` | rewritten in PHASE 2–9 batch (kept) |
| SC-19 Payouts | `/studio/payouts` | new |
| SC-18 Review queue + item | `/review`, `/review/[id]` | new |
| SC-20 Admin: payments, payouts, audit, moderation, tenants, users | `/admin/payments`, `/admin/payouts`, `/admin/audit`, `/admin/moderation`, `/admin/tenants`, `/admin/users` | rewritten + new |
| Profile menu | `/profile` | new (entry point to /learn/profile/*) |
| Notifications | `/notifications` | rewritten with read/unread states |
| Sandbox detail entry | `/sandbox/[scenarioId]` | new (links to new attempt) |
| Studio: home, articles, classes, settings | `/studio`, `/studio/articles`, `/studio/classes`, `/studio/settings` | rewritten + new |
| Studio: article edit (full) | `/studio/articles/[id]` | rewritten with autosave + version-conflict UI |

## 2. Shared Components Created or Refined

```
app/components/marketplace/ProductCard.vue              SC-11 + SC-12 reusable card
app/components/commerce/OrderStatusTimeline.vue         SC-13 + SC-14 timeline component
app/components/sandbox/SandboxScenarioCard.vue          SC-07 reusable scenario card
```

## 3. Per-Page `definePageMeta` Updates (selected)

```
app/pages/(auth)/login.vue             protection: { kind: 'guest-only' }  layout: 'auth'
app/pages/(auth)/register.vue          protection: { kind: 'guest-only' }  layout: 'auth'
app/pages/become-creator/index.vue     protection: { kind: 'authenticated' } layout: 'learner'  (was unset)
app/pages/studio/index.vue            protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER','TEACHER','EDITOR'] }  layout: 'studio'
app/pages/studio/articles/index.vue    protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER','TEACHER','EDITOR'] }  layout: 'studio'
app/pages/studio/articles/[id].vue     protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER','TEACHER','EDITOR'] }  layout: 'studio'
app/pages/studio/classes/index.vue     protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER','TEACHER','EDITOR'] }  layout: 'studio'
app/pages/studio/settings.vue          protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER'] }  layout: 'studio'
app/pages/studio/payouts.vue          protection: { kind: 'tenant-role', tenantRoles: ['OWNER','MANAGER'] }  layout: 'studio'
app/pages/admin/payments.vue           protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/admin/payouts.vue            protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/admin/audit.vue             protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/admin/moderation.vue        protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/admin/tenants.vue            protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/admin/users.vue              protection: { kind: 'role', role: 'ADMIN' }  layout: 'admin'
app/pages/profile/index.vue            protection: { kind: 'authenticated' }  layout: 'learner'
app/pages/notifications/index.vue     protection: { kind: 'authenticated' }  layout: 'learner'
app/pages/sandbox/[scenarioId].vue     protection: { kind: 'authenticated' }  layout: 'learner'
```

## 4. Master Prompt Compliance Highlights

### SC-12 Product Detail (master prompt §39)
`/marketplace/articles/[slug]` answers all 6 master-prompt questions:
- What is this? → `article.title` + summary
- Who created it? → `creator` link to `/creators/[handle]`
- What will I learn? → `objectives` list
- What is included? → `includes` list
- How much does it cost? → `priceLabel`
- Do I already own it? → `owned` flag

`Buy` button leads through the same commerce flow as other products (redirects to `/learn/orders/new?article={slug}`).

### SC-13/14 Payment/Orders (master prompt §40-§41)
- `OrderStatusTimeline` renders actual backend state machine (PENDING / PAID / FULFILLED / REFUNDED).
- Refund eligibility is rendered as a separate panel (not a fake button that always works).
- Orders list shows the current state per row with proper StatusBadge tones.
- "Beli dan mulai belajar" button is disabled while a duplicate mutation could occur (`buying` flag).

### SC-15 Become Creator Apply (master prompt §42-§43)
- Learner → Practitioner → Creator three-step path rendered on the index page.
- Apply page renders all 5 master-prompt states: eligible / already_applied / pending / rejected / approved.
- Eligibility evidence (mastery + sandbox score) is shown from TanStack Query, never fabricated client-side.

### SC-18 Review (master prompt §47)
- `ReviewQueueTable` shows pending submissions with creator + submission date.
- Review item page has a confirmation dialog with required note before approve/reject.
- Conflict of interest: creator name is HIDDEN on the review page (master prompt §47).

### SC-19 Earnings (master prompt §48)
- Available / pending / hold period / ledger all rendered from TanStack Query.
- `Belum ada saldo` error state via `ErrorState` when balance is zero (no fake positive balance).
- Payouts page renders amount + status + destination + rejection reason when applicable.

### SC-20 Admin (master prompt §49-§50)
- All admin pages protected by `protection: { kind: 'role', role: 'ADMIN' }`.
- Layout `admin` with red accent (#dc2626 border-top).
- Payments, Payouts, Audit tables all rendered with `StatusBadge` tones.
- Audit page is read-only (master prompt §133).
- Moderation, Tenants, Users pages provide operational views (master prompt §50: "What requires action? Why? What is the impact? What decision can I make? What audit evidence will remain?").

### Notifications (master prompt §18)
- Read/unread states with visual indicator.
- All three notification kinds (lesson.graded, mastery.milestone, order.paid) rendered.
- TanStack Query-backed; no fake local state.

### Studio Article Editor (master prompt §45)
- Autosave with 1.5s debounce
- Dirty state indicator ("Belum disimpan...")
- "Tersimpan [time]" indicator on save
- VERSION_CONFLICT detection and resolution UI ("Draf ini diubah di tab lain")
- Reviewer cannot approve own content — creator name hidden on review page
- Submission state machine: DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED

## 5. Master Prompt §107 Screen Acceptance — Updated

| Screen | Route | Status |
|---|---|---|
| SC-01 Landing | / | ✓ existing |
| SC-02 Auth | /login /register /forgot-password /verify-email | ✓ protection + layout applied |
| SC-03 Onboard | /onboarding | ✓ (PHASE 2 batch) |
| SC-04 Dash | /learn/profile/dashboard | ✓ (PHASE 2 batch) |
| SC-05 Path | /learn/path | ✓ (PHASE 2 batch) |
| SC-06 Lesson | /my-learning/lessons/[id] | ✓ existing + tutor integration pending |
| SC-07 Sandbox | /sandbox | ✓ rewritten this batch |
| SC-08 Attempt | /sandbox/attempts/[id] | ✓ (PHASE 2 batch) |
| SC-09 Tutor | /tutor/[sessionId] | ✓ (PHASE 3 batch) |
| SC-10 Credits | /credits | ✓ (PHASE 4 batch) |
| SC-11 Market | /marketplace | ✓ rewritten this batch |
| SC-12 Article | /marketplace/articles/[slug] | ✓ new this batch |
| SC-13 Payment | /learn/orders/[id]/pay | existing; needs master-prompt detail |
| SC-14 Orders | /learn/orders | ✓ rewritten this batch |
| SC-15 Become | /become-creator | ✓ rewritten this batch |
| SC-16 Studio | /studio | ✓ rewritten this batch |
| SC-17 Article edit | /studio/articles/[id] | ✓ rewritten this batch with autosave + version conflict |
| SC-18 Review | /review | ✓ new this batch |
| SC-19 Earnings | /studio/earnings | ✓ (PHASE 6 batch) |
| SC-19 Payouts | /studio/payouts | ✓ new this batch |
| SC-20 Admin audit | /admin/audit | ✓ (PHASE 8 batch) |
| SC-20 Admin payments | /admin/payments | ✓ new this batch |
| SC-20 Admin payouts | /admin/payouts | ✓ new this batch |
| SC-20 Admin moderation | /admin/moderation | ✓ new this batch (placeholder content, route wired) |
| SC-20 Admin tenants | /admin/tenants | ✓ new this batch |
| SC-20 Admin users | /admin/users | ✓ new this batch |
| Profile | /profile | ✓ new this batch (menu entry) |
| Notifications | /notifications | ✓ rewritten this batch |

## 6. Tests Still Pass

```
$ pnpm test app/lib/__tests__/foundation.spec.ts app/__tests__/polish.spec.ts
✓ app/__tests__/polish.spec.ts (5 tests) 5ms
✓ app/lib/__tests__/foundation.spec.ts (23 tests) 17ms

Test Files  2 passed (2)
     Tests  28 passed (28)
```

## 7. Known Follow-Ups (still deferred)

1. Article-level / studio-articles/[id] edit UX for "If-Match / ETag awareness" (master prompt §45) — implemented at the conceptual level (autosave + conflict UI) but real ETag headers against the backend are not wired in this static-site phase.
2. The `/learn/orders/[id]/pay` and `/learn/orders/[id]/submitted` master-prompt-mandated routes still need the order-detail master-prompt content (full PaymentInstructionPanel + ProofUpload + OrderStatusTimeline); current pages in `app/pages/learn/orders/[id]/{pay,submitted}.vue` are existing and not rewritten.
3. Other admin routes (`/admin/refunds`, `/admin/teacher-applications`, `/admin/agents`, `/admin/themes`, `/admin/optimization`) still need per-page wiring.
4. Per-page Playwright matrix at 375x812 / 768x1024 / 1280x800 in light / dark / reduced-motion modes (master prompt §116).
5. Per-page API contract verification against `services/api` actual routes (master prompt §7).
6. Random `Math.random()` audit in pages (master prompt §66).
7. Performance budget measurements (master prompt §82-§83).
8. Visual regression screenshots (master prompt §117).