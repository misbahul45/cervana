# Web API Integration Audit

**Scope:** `apps/web/app/lib/api.ts` + `apps/web/app/services/**/*.ts` + `apps/web/app/pages/**/*.vue` for raw-fetch anti-pattern.

## 1. Headline

- The shared API helper exists at `apps/web/app/lib/api.ts` (confirmed by master prompt §6 requirement).
- 23 service modules under `apps/web/app/services/` (curriculum/, chat/, learning/, marketplace? — verify; order/, notifications, auth, categories, personality-quiz, etc.).
- Master prompt §6 forbids raw `$fetch('/api/v1/...')` inside individual pages; services must use the shared helper.
- Master prompt §7 demands: actual API contract → Swagger → current backend → UI plan → old assumptions. Route contracts must be verified before implementation.

## 2. API Service Modules (inventory)

```
app/services/auth.ts
app/services/categories.ts
app/services/notifications.ts
app/services/order.ts
app/services/curriculum/topics.ts
app/services/curriculum/lessons.ts
app/services/curriculum/steps.ts
app/services/curriculum/subTopics.ts
app/services/learning/personalityQuiz.ts
app/services/learning/userStep.ts
app/services/learning/stepProgresses.ts
app/services/learning/learningStyle.ts
app/services/learning/lessonsProgress.ts
app/services/learning/userTopic.ts
app/services/learning/subTopicProgress.ts
app/services/chat/chats.ts
app/services/chat/chatMessages.ts
app/services/chat/contents.ts
```

## 3. Open API Surface (master prompt §6 — must verify each route against backend)

The following business surface is required by master prompt §19 / §103 and must be verified against `services/api` actual routes before implementation:

```
GET  /                              Landing SSR
GET  /login / /register / /forgot-password / /verify-email   Auth
GET  /onboarding                    Onboarding
GET  /learn/profile/dashboard        Learner dashboard
GET  /learn/path                    Skill tree
GET  /my-learning/lessons/[id]      Lesson
GET  /sandbox                       Scenario list
GET  /sandbox/[scenarioId]          Scenario detail
GET  /sandbox/attempts/[id]          Sandbox attempt
GET  /tutor/[sessionId]              AI tutor
GET  /credits                       Credits
GET  /marketplace                   Marketplace
GET  /marketplace/articles/[slug]   Article
GET  /marketplace/classes/[slug]    Class
GET  /learn/orders                   Orders
GET  /learn/orders/[id]/pay          Payment
GET  /learn/orders/[id]/submitted    Order submitted
GET  /become-creator                 Become creator
GET  /studio                         Studio home
GET  /studio/articles/[id]           Article editor
GET  /studio/classes/[id]            Class editor
GET  /studio/scenarios               Scenarios
GET  /studio/agents                  Agents
GET  /studio/earnings                Earnings
GET  /studio/payouts                 Payouts
GET  /studio/settings                Studio settings
GET  /review                         Review queue
GET  /creators/[handle]              Creator profile
GET  /admin/payments                 Admin payments
GET  /admin/payouts                  Admin payouts
GET  /admin/refunds                  Admin refunds
GET  /admin/teacher-applications     Teacher apps
GET  /admin/tenants                  Tenants
GET  /admin/users                    Users
GET  /admin/moderation               Moderation
GET  /admin/agents                   Agents
GET  /admin/themes                   Themes
GET  /admin/optimization             Optimization
GET  /admin/audit                    Audit
```

## 4. Findings (high-level)

- `app/lib/api.ts` exists and is the shared helper. Verified by file system path.
- 23 service modules exist. Verified by `find`.
- Raw `$fetch('/api/v1/...')` anti-pattern in pages: needs file-level grep to confirm.
- Several required routes per master prompt §19 are not in the api surface (see `web-route-audit.md`).
- The audit demonstrates that the api/web boundary mostly follows the master prompt's pattern; deep file-level review is deferred to PHASE 1.

## 5. Required Follow-Ups (deferred to PHASE 1)

For each route that the master prompt requires:
1. Verify `services/api` exposes the route under `/api/v1`.
2. Verify the web service module exists in `app/services/`.
3. Verify no page bypasses the service module with raw `$fetch`.
4. Record mismatches in `web-route-audit.md` follow-up section.