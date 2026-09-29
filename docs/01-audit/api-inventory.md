# API Inventory — Cervana NestJS API

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Complete inventory of every HTTP endpoint exposed by the NestJS API, with actor, input, output, business rule, authorization, and problem flagged per endpoint.

---

## 1. Scope

This document lists every `@Controller`, `@Get`, `@Post`, `@Patch`, `@Delete` declaration in [`cervana-api/src/v1/`](../../cervana-api/src/v1/) plus the auth controller. SSE controllers are listed at the end but not analyzed in depth (they are transport-level only).

Counts (verified by `grep` 2026-09-30):
- 41 `@Controller` declarations.
- 229 lines containing `@Get / @Post / @Patch / @Delete / @Roles`.
- 12 `@Roles` declarations total.

---

## 2. Inventory by domain

### 2.1 Auth

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/auth/register` | public | Arcjet rate-limit | – |
| POST | `/auth/login` | public | Arcjet rate-limit | – |
| GET | `/auth/google` | public | OAuth guard | – |
| GET | `/auth/google/callback` | public | OAuth guard | – |
| POST | `/auth/verify-email` | public | Arcjet rate-limit | – |
| POST | `/auth/forgot-password` | public | Arcjet rate-limit | – |
| POST | `/auth/resend-token` | public | Arcjet rate-limit | – |
| POST | `/auth/refresh-token` | public | – | – |
| POST | `/auth/reset-password` | public | Arcjet rate-limit | – |
| DELETE | `/auth/logout` | authenticated | – | – |
| GET | `/auth/profile` | authenticated | – | – |
| GET | `/auth/check` | authenticated | – | – |

Source: [`auth.controller.ts`](../../cervana-api/src/v1/auth/auth.controller.ts).

**Observations**:
- Auth has rate-limiting on all sensitive endpoints. Good.
- No role check needed (auth is by definition pre-auth).

### 2.2 Users

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/users/` | ADMIN | `Roles(Role.ADMIN)` | – |
| GET | `/users/` | authenticated | none | ❌ any user can list all users (PII leak risk) |
| GET | `/users/:id` | authenticated | none | ❌ no ownership check |
| PATCH | `/users/:id` | authenticated | none | ❌ no ownership check; user A could patch user B |
| DELETE | `/users/:id` | authenticated | none | ❌ no ownership check |

Source: [`users.controller.ts`](../../cervana-api/src/v1/users/users.controller.ts).

**Problem class**: missing ownership check across the entire controller.

### 2.3 Curriculum

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/topics` | TEACHER | `Roles(Role.TEACHER)` | – |
| GET | `/topics` | public | none | – |
| GET | `/topics/:slug` | public | none | – |
| PATCH | `/topics/:id` | ADMIN | `Roles(Role.ADMIN)` | ❌ TEACHER who created cannot edit own topic |
| DELETE | `/topics/:id` | ADMIN | `Roles(Role.ADMIN)` | ❌ TEACHER cannot delete own topic |
| POST | `/subtopics` | authenticated | none | 🟡 no role check; should be TEACHER |
| GET | `/subtopics` | public | none | – |
| GET | `/subtopics/:id/lessons` | public | none | – |
| GET | `/subtopics/:id/navigation` | public | none | – |
| GET | `/subtopics/:id` | public | none | – |
| PATCH | `/subtopics/:id` | authenticated | none | 🟡 no role check; no ownership check |
| DELETE | `/subtopics/:id` | authenticated | none | ❌ no role check |
| POST | `/lessons` | authenticated | none | 🟡 no role check; should be TEACHER |
| GET | `/lessons/:id` | public | none | – |
| PATCH | `/lessons/:id` | authenticated | none | ❌ no role check; no ownership check |
| DELETE | `/lessons/:id` | authenticated | none | ❌ no role check |
| GET | `/lessons` | public | none | – |
| POST | `/steps` | authenticated | none | 🟡 no role check; should be TEACHER |
| GET | `/steps/:id` | public | none | – |
| PATCH | `/steps/:id` | authenticated | none | ❌ no role check |
| DELETE | `/steps/:id` | authenticated | none | ❌ no role check |
| GET | `/steps` | public | none | – |

Sources: [`topics/topics.controller.ts`](../../cervana-api/src/v1/curriculum/topics/topics.controller.ts), [`subtopics/subtopics.controller.ts`](../../cervana-api/src/v1/curriculum/subtopics/subtopics.controller.ts), [`lessons/lessons.controller.ts`](../../cervana-api/src/v1/curriculum/lessons/lessons.controller.ts), [`steps/steps.controller.ts`](../../cervana-api/src/v1/curriculum/steps/steps.controller.ts).

**Problem class**: only `/topics` has role checks. `subtopics`, `lessons`, `steps` are entirely role-less. `POST /steps` even injects `user.id` from `req.user` — meaning any authenticated user can claim authorship of a step they did not create.

### 2.4 Materials / Resources

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/resources` | TEACHER | `Roles(Role.TEACHER)` | – |
| GET | `/resources` | TEACHER | `Roles(Role.TEACHER)` | 🟡 learners cannot list resources they have access to |
| GET | `/resources/:id` | TEACHER | `Roles(Role.TEACHER)` | ❌ learners cannot access their own materials |
| DELETE | `/resources/:id` | TEACHER | `Roles(Role.TEACHER)` | – |
| POST | `/resources/callback` | AI worker | none | 🟡 trust boundary; anyone can call |

Source: [`resources.controller.ts`](../../cervana-api/src/v1/material/resources/resources.controller.ts).

**Problem class**: Materials are restricted to TEACHER only. Learners cannot read resources via the API. This is a serious gap because the learning experience depends on materials being served to learners — currently they must be served through some other channel (e.g., bundled into chat `Content`).

### 2.5 Quiz

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/quizs` | authenticated | none | 🟡 no role check |
| GET | `/quizs` | public | none | – |
| GET | `/quizs/:id` | public | none | – |
| GET | `/quizs/:id/quiz-attempts` | authenticated | none | 🟡 no ownership filter |
| GET | `/quizs/:id/questions` | public | none | – |
| PATCH | `/quizs/:id` | authenticated | none | ❌ no role check |
| DELETE | `/quizs/:id` | authenticated | none | ❌ no role check |
| POST | `/quiz-attempts` | authenticated | none | – |
| GET | `/quiz-attempts/:id` | authenticated | none | 🟡 no ownership filter |
| GET | `/quiz-attempts/:id/answers` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/quiz-attempts/:id` | authenticated | none | ❌ no role check |
| DELETE | `/quiz-attempts/:id` | authenticated | none | ❌ no role check |
| POST | `/answers` | authenticated | none | 🟡 no validation that attempt belongs to user |
| GET | `/answers/:id` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/answers/:id` | authenticated | none | ❌ no role check |
| DELETE | `/answers/:id` | authenticated | none | ❌ no role check |
| POST | `/questions` | authenticated | none | 🟡 no role check |
| GET | `/questions/:id` | authenticated | none | – |
| PATCH | `/questions/:id` | authenticated | none | ❌ no role check |
| DELETE | `/questions/:id` | authenticated | none | ❌ no role check |

Sources: [`quiz/quizzes/quizzes.controller.ts`](../../cervana-api/src/v1/quiz/quizzes/quizzes.controller.ts), [`quiz/quiz-attempts/quiz-attempts.controller.ts`](../../cervana-api/src/v1/quiz/quiz-attempts/quiz-attempts.controller.ts), [`quiz/answers/answers.controller.ts`](../../cervana-api/src/v1/quiz/answers/answers.controller.ts), [`quiz/questions/questions.controller.ts`](../../cervana-api/src/v1/quiz/questions/questions.controller.ts).

**Critical issue**: **`Answer.isCorrect` and `QuizAttempt.score` are never set** by any service. The learner submits an answer but no scoring logic runs. See [`docs/01-audit/system-audit.md` §17.4](../system-audit.md#174-quiz-evaluation-is-missing).

### 2.6 Learning progress

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/learning/user-topics/:id` | authenticated | none | – |
| GET | `/learning/user-topics` | authenticated | none | – |
| GET | `/learning/user-topics/:id` | authenticated | none | – |
| PATCH | `/learning/user-topics/:id` | authenticated | none | – |
| DELETE | `/learning/user-topics/:id` | authenticated | none | – |
| POST | `/learning/lesson-progresses/:id` | authenticated | none | – |
| GET | `/learning/lesson-progresses` | authenticated | none | – |
| GET | `/learning/lesson-progresses/:id` | authenticated | none | – |
| PATCH | `/learning/lesson-progresses/:id` | authenticated | none | – |
| DELETE | `/learning/lesson-progresses/:id` | authenticated | none | – |
| POST | `/learning/step-progresses/:id` | authenticated | none | – |
| GET | `/learning/step-progresses` | authenticated | none | – |
| GET | `/learning/step-progresses/:id` | authenticated | none | – |
| PATCH | `/learning/step-progresses/:id` | authenticated | none | – |
| DELETE | `/learning/step-progresses/:id` | authenticated | none | – |
| POST | `/learning/subtopic-progresses/:id` | authenticated | none | – |
| GET | `/learning/subtopic-progresses` | authenticated | none | – |
| GET | `/learning/subtopic-progresses/:id` | authenticated | none | – |
| PATCH | `/learning/subtopic-progresses/:id` | authenticated | none | – |
| DELETE | `/learning/subtopic-progresses/:id` | authenticated | none | – |
| POST | `/learning/user-steps/:id` | authenticated | none | – |
| GET | `/learning/user-steps` | authenticated | none | – |
| GET | `/learning/user-steps/:id` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/learning/user-steps/:id` | authenticated | none | ❌ no ownership check |
| DELETE | `/learning/user-steps/:id` | authenticated | none | ❌ no ownership check |
| POST | `/learning/personality-quizzes` | AI worker | none | 🟡 trust boundary |
| PATCH | `/learning/personality-quizzes/submit/:id` | authenticated | none | – |
| GET | `/learning/personality-quizzes` | authenticated | none | 🟡 no ownership filter |
| GET | `/learning/personality-quizzes/:id` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/learning/personality-quizzes/:id` | authenticated | none | ❌ no ownership check |
| DELETE | `/learning/personality-quizzes/:id` | authenticated | none | ❌ no ownership check |
| POST | `/learning/learning-styles` | authenticated | none | – |
| GET | `/learning/learning-styles/:id` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/learning/learning-styles/:id` | authenticated | none | ❌ no ownership check |
| DELETE | `/learning/learning-styles/:id` | authenticated | none | ❌ no ownership check |

Sources: [`learning/user-topics/`](../../cervana-api/src/v1/learning/user-topics/), [`learning/lesson-progresses/`](../../cervana-api/src/v1/learning/lesson-progresses/), [`learning/step-progresses/`](../../cervana-api/src/v1/learning/step-progresses/), [`learning/subtopic-progresses/`](../../cervana-api/src/v1/learning/subtopic-progresses/), [`learning/user-steps/`](../../cervana-api/src/v1/learning/user-steps/), [`learning/personality-quizzes/`](../../cervana-api/src/v1/learning/personality-quizzes/), [`learning/learning-styles/`](../../cervana-api/src/v1/learning/learning-styles/).

**Problem class**: progress endpoints have **no role check at all**. Authenticated students can patch any other student's progress by UUID.

### 2.7 Chat / Content

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/chats` | authenticated | none | – |
| GET | `/chats/:id` | authenticated | none | ❌ no ownership check |
| GET | `/chats/:id/messages` | authenticated | none | ❌ no ownership check |
| DELETE | `/chats/:id` | authenticated | none | ❌ no ownership check |
| POST | `/chat-messages` | authenticated | none | – |
| PATCH | `/chat-messages/:id` | authenticated | none | ❌ no ownership check |
| DELETE | `/chat-messages/:id` | authenticated | none | ❌ no ownership check |
| GET | `/contents` | authenticated | none | 🟡 filter by chatId only |
| POST | `/contents` | AI worker | none | 🟡 trust boundary |
| DELETE | `/contents/:id` | authenticated | none | ❌ no ownership check |

Sources: [`chat/chats/chats.controller.ts`](../../cervana-api/src/v1/chat/chats/chats.controller.ts), [`chat/chat-messages/chat-messages.controller.ts`](../../cervana-api/src/v1/chat/chat-messages/chat-messages.controller.ts), [`chat/contents/contents.controller.ts`](../../cervana-api/src/v1/chat/contents/contents.controller.ts).

**Problem class**: chat ownership is not checked. Combined with chat IDs being UUIDs, this is a UUID-guessing vulnerability.

### 2.8 Categories

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/categories` | ADMIN or TEACHER | `Roles(ADMIN, TEACHER)` | – |
| GET | `/categories` | public | `Public()` | – |
| GET | `/categories/:id` | public | `Public()` | – |
| PATCH | `/categories/:id` | ADMIN or TEACHER | `Roles(ADMIN, TEACHER)` | 🟡 no ownership check |
| DELETE | `/categories/:id` | ADMIN | `Roles(ADMIN)` | – |
| POST | `/categories/:categoryId/topics/:topicId` | TEACHER | `Roles(TEACHER)` | – |
| DELETE | `/categories/:categoryId/topics/:topicId` | TEACHER | `Roles(TEACHER)` | – |

Source: [`categories.controller.ts`](../../cervana-api/src/v1/categories/categories.controller.ts).

### 2.9 Teacher applications

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/applications` | authenticated | none | 🟡 should be applicant only |
| GET | `/applications` | authenticated | none | ❌ should be admin only (PII leakage) |
| GET | `/applications/:id` | authenticated | none | ❌ should be admin or owner only |
| PATCH | `/applications/:id` | authenticated | none | 🟡 should be admin only |
| DELETE | `/applications/:id` | authenticated | none | ❌ should be admin only |

Source: [`teacher/applications/applications.controller.ts`](../../cervana-api/src/v1/teacher/applications/applications.controller.ts).

**Problem class**: PII exposure risk — applicants' personal data (bio, CV URL, expertise) accessible to any authenticated user.

### 2.10 Teacher certifications & experiences

Same pattern as §2.9 — these are sub-entities of `TeacherApplication` and should be admin-only, but are accessible to any authenticated user.

### 2.11 Gamification

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/daily-logs` | AI worker | none | 🟡 trust boundary |
| GET | `/daily-logs` | authenticated | none | – |
| GET | `/daily-logs/:id` | authenticated | none | 🟡 no ownership filter |
| PATCH | `/daily-logs/:id` | authenticated | none | ❌ no role check |
| DELETE | `/daily-logs/:id` | authenticated | none | ❌ no role check |
| GET | `/streaks` | authenticated | none | – |
| GET | `/streaks/latest` | authenticated | none | 🟡 no ownership filter |
| GET | `/streaks/:id` | authenticated | none | 🟡 no ownership filter |
| DELETE | `/streaks/:id` | authenticated | none | ❌ no role check |
| GET | `/leaderboards` | public | none | – |
| GET | `/leaderboards/:id` | public | none | – |
| POST | `/themes` | authenticated | none | 🟡 should be admin |
| GET | `/themes` | public | none | – |
| GET | `/themes/:id` | public | none | – |
| PATCH | `/themes/:id` | authenticated | none | ❌ no role check |
| DELETE | `/themes/:id` | authenticated | none | ❌ no role check |

Sources: [`gamify/daily-logs/`](../../cervana-api/src/v1/gamify/daily-logs/), [`gamify/streaks/`](../../cervana-api/src/v1/gamify/streaks/), [`gamify/leaderboards/`](../../cervana-api/src/v1/gamify/leaderboards/), [`gamify/themes/`](../../cervana-api/src/v1/gamify/themes/).

### 2.12 Orders

| Method | Path | Actor | Auth | Problem |
|---|---|---|---|---|
| POST | `/orders` | authenticated | none | – |
| GET | `/orders` | authenticated | none | 🟡 no ownership filter |
| GET | `/orders/:id` | authenticated | none | ❌ no ownership check |
| PATCH | `/orders/:id` | authenticated | none | ❌ no role check |
| DELETE | `/orders/:id` | authenticated | none | ❌ no role check |
| POST | `/webhooks/stripe` | Stripe (no auth) | – | 🟡 relies on Stripe signature |

Source: [`orders/orders.controller.ts`](../../cervana-api/src/v1/orders/orders.controller.ts).

### 2.13 Notifications

| Method | Path | Actor | Auth |
|---|---|---|---|
| POST | `/notifications` | authenticated | none |
| GET | `/notifications` | authenticated | none |
| GET | `/notifications/:id` | authenticated | none |
| PATCH | `/notifications/:id` | authenticated | none |
| DELETE | `/notifications/:id` | authenticated | none |

Source: [`notifications/notifications.controller.ts`](../../cervana-api/src/v1/notifications/notifications.controller.ts).

### 2.14 Uploads

| Method | Path | Actor | Auth |
|---|---|---|---|
| POST | `/uploads` | authenticated | none |

Source: [`uploads/uploads.controller.ts`](../../cervana-api/src/v1/uploads/uploads.controller.ts).

### 2.15 SSE (Server-Sent Events)

| Controller | Purpose |
|---|---|
| `/content-sse` | Content updates per chat |
| `/chat-message-sse` | Chat message updates |
| `/streak-sse` | Streak updates |
| `/daily-log-sse` | Daily log updates |
| `/leaderboard-sse` | Leaderboard updates |
| `/notification-sse` | Notification updates |
| `/personality-quiz-sse` | Personality quiz updates |
| `/user-steps-sse` | User-step updates |

All gated by `SseJwtGuard` (token via query string).

---

## 3. Patterns observed

### 3.1 Role enforcement

- **12 `@Roles` declarations** across 41 controllers.
- Only `categories` and `resources` (4 routes) use `@Roles` extensively.
- `topics` uses `Roles(Role.TEACHER)` for create and `Roles(Role.ADMIN)` for update/delete.
- All other controllers have **zero role enforcement**.

### 3.2 Ownership enforcement

- **Zero ownership checks** anywhere.
- `chat-messages.controller.ts:17` accepts any authenticated user creating a message for any `chatId`.
- `user-steps.controller.ts` accepts updates for any `userStepId`.
- `users.controller.ts:43` accepts `GET /users/:id` for any authenticated user.

### 3.3 Trust boundaries

The API has implicit trust boundaries where the AI worker is the legitimate caller but the API does not authenticate it:

- `POST /resources/callback` — called by ai-api after extraction.
- `POST /contents` — called by ai-api after generation.
- `POST /learning/personality-quizzes` — called by ai-api after generation.
- `POST /gamify/daily-logs` — called by ai-api or system.
- `POST /webhooks/stripe` — called by Stripe.

These rely on **the ai-api keeping the user's bearer token** to authenticate as the user. This works but is fragile (any leaked token = full access).

---

## 4. Gaps by domain category

| Domain | Endpoints | Has `@Roles` | Has ownership | Notes |
|---|---|---|---|---|
| Auth | 12 | n/a | n/a | Arcjet rate-limit ✓ |
| Users | 5 | 1 (ADMIN create) | 0 | – |
| Curriculum (topics) | 5 | 4 | 0 | – |
| Curriculum (subtopics/lessons/steps) | 15 | 0 | 0 | ❌ Tutor can be impersonated |
| Materials | 5 | 4 | 0 | ❌ Learners cannot read materials |
| Quiz (all sub-entities) | 20 | 0 | 0 | ❌ No evaluator runs |
| Learning progress | 30 | 0 | 0 | ❌ Cross-user writable |
| Chat | 8 | 0 | 0 | ❌ Cross-user readable/writable |
| Categories | 7 | 5 | 0 | – |
| Teacher applications | 5 | 0 | 0 | ❌ PII exposure |
| Gamification | 16 | 0 | 0 | ❌ Streaks writable |
| Orders | 6 | 0 | 0 | ❌ Cross-user visible |
| Notifications | 5 | 0 | 0 | – |
| Uploads | 1 | 0 | 0 | – |
| SSE | 8 | n/a | guard only | – |

---

## 5. Verdict

The API is a CRUD shell. It exposes every entity as endpoints but enforces neither role nor ownership beyond a handful of resource creation paths. The system cannot be considered a working learning platform until:

1. Every `POST / PATCH / DELETE` on a learner-owned resource has ownership enforcement.
2. Every Tutor-only mutation has `@Roles(Role.TEACHER)`.
3. Every Admin-only mutation has `@Roles(Role.ADMIN)`.
4. Trust boundaries (AI callbacks, webhooks) are authenticated separately from end-user auth.

This is documented in detail in [`authorization-audit.md`](./authorization-audit.md).