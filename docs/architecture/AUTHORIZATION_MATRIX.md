# Authorization matrix

> Generated from the running application: route paths come from the Swagger document, access decisions from the metadata that guards read at runtime. Regenerate after route changes; `route-access.spec.ts` fails the build if any route lacks an explicit decision.

## How access is decided

Guards run in this order for every request: `JwtAuthGuard` (authentication) → `RolesGuard` (`@Roles`) → `OwnershipGuard` (`@RequireOwnership` / `@RequireParentOwnership`) → route guards (`TenantGuard` for `@TenantScoped`, `InternalServiceGuard` for `@InternalOnly`). `@ScopeToUser` adds an interceptor that pins `userId` on query and body. Services repeat the check for anything the metadata cannot express (for example order state).

| Decision | Meaning | Routes |
|---|---|---|
| Public | No credentials | 15 |
| Service | Signed service-to-service request | 2 |
| Role | Global role required | 57 |
| Tenant | Membership in the named tenant | 2 |
| Owner | Owner of the resource, or ADMIN | 68 |
| Own rows | Only the caller rows; ADMIN unrestricted | 17 |
| Authenticated | Any signed-in user, row rules in service | 34 |
| **Total** | | **195** |

## Policy by actor (product terminology: USER = `STUDENT` in the database)

| Capability | USER | TEACHER | ADMIN |
|---|---|---|---|
| Read own profile / update name and image | Y | Y | Y |
| Change any role, activate or deactivate accounts | N | N | Y (never on self) |
| Apply to become a teacher | Y | N | N |
| Approve or reject a teacher application | N | N | Y (never own) |
| Create an order for a product (topic, article, class) | Y | Y | Y |
| Read an order | own | own | all |
| Submit a payment proof | own order | own order | own order |
| Review, approve or reject a payment proof | N | N | Y |
| Reconcile a payment, run the expiry sweep | N | N | Y |
| Refund an order | not available (next phase) | not available | not available |
| Cancel an order | own, while pending | own, while pending | any |
| Enroll in a topic | free topics only | free topics only | any |
| Read or write learning progress, attempts, chats | own | own | all |
| Write curriculum (topics, lessons, steps, quizzes) | N | Y | Y |
| Delete curriculum | N | N | Y |
| Read own tenant | N | Y (member) | Y (names tenant) |
| Update tenant details | N | OWNER or MANAGER | Y |
| List, suspend, activate tenants | N | N | Y |
| Global gamification writes (daily logs, streak deletion, themes) | N | N | Y |
| Internal callbacks and resource reads | N | N | N (services only) |

## Every route

| Method | Path | Decision | Detail |
|---|---|---|---|
| POST | `/admin/entitlements/backfill/topic` | Role | ADMIN |
| POST | `/admin/payments/expire-due` | Role | ADMIN |
| POST | `/admin/payments/intents/{intentId}/reconcile` | Role | ADMIN |
| GET | `/admin/payments/manual/submissions` | Role | ADMIN |
| GET | `/admin/payments/manual/submissions/{id}` | Role | ADMIN |
| POST | `/admin/payments/manual/submissions/{id}/approve` | Role | ADMIN |
| POST | `/admin/payments/manual/submissions/{id}/reject` | Role | ADMIN |
| POST | `/admin/payments/manual/submissions/{id}/start-review` | Role | ADMIN |
| GET | `/admin/tenants` | Role | ADMIN |
| POST | `/admin/tenants/{id}/activate` | Role | ADMIN |
| POST | `/admin/tenants/{id}/suspend` | Role | ADMIN |
| GET | `/daily-log-sse/stream (SSE)` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/auth/check` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/auth/forgot-password` | Public | No credentials; the answer is identical for a registered and an unregistered email |
| POST | `/auth/login` | Public | No credentials |
| DELETE | `/auth/logout` | Authenticated | Any signed-in user; revokes the session behind the access token, so the refresh token and the access token stop working |
| GET | `/auth/profile` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/auth/refresh-token` | Public | No credentials |
| POST | `/auth/register` | Public | No credentials |
| POST | `/auth/resend-token` | Public | No credentials; `type` is `email` or `pw`; the answer is identical for a registered and an unregistered email |
| POST | `/auth/reset-password` | Public | No credentials; a 6-digit code valid 15 minutes, at most 5 wrong tries, single use; signs every device out |
| POST | `/auth/verify-email` | Public | No credentials; a 6-digit code valid 15 minutes, at most 5 wrong tries, single use |
| GET | `/categories` | Public | No credentials |
| POST | `/categories` | Role | ADMIN or TEACHER |
| DELETE | `/categories/{categoryId}/topics/topicId` | Role | TEACHER |
| POST | `/categories/{categoryId}/topics/topicId` | Role | TEACHER |
| DELETE | `/categories/{id}` | Role | ADMIN |
| GET | `/categories/{id}` | Public | No credentials |
| PATCH | `/categories/{id}` | Role | ADMIN or TEACHER |
| GET | `/chat-message-sse` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/chat/chat-messages` | Owner | Owner or ADMIN of `chat@body:chatId` |
| DELETE | `/chat/chat-messages/{id}` | Owner | Owner or ADMIN of `message` |
| PATCH | `/chat/chat-messages/{id}` | Owner | Owner or ADMIN of `message` |
| POST | `/chat/chats` | Owner | Owner or ADMIN of `user-step@body:userStepId` |
| DELETE | `/chat/chats/{id}` | Owner | Owner or ADMIN of `chat` |
| GET | `/chat/chats/{id}` | Owner | Owner or ADMIN of `chat` |
| GET | `/chat/chats/{id}/messages` | Owner | Owner or ADMIN of `chat` |
| GET | `/chat/contents` | Owner | Owner or ADMIN of `chat@query:chatId` |
| POST | `/chat/contents` | Owner | Owner or ADMIN of `chat@body:chatId` |
| GET | `/chat/contents/similarity` | Owner | Owner or ADMIN of `chat@query:chatId` |
| DELETE | `/chat/contents/{id}` | Owner | Owner or ADMIN of `content` |
| GET | `/content-sse` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/curriculum/lessons` | Role | ADMIN or TEACHER |
| DELETE | `/curriculum/lessons/{id}` | Role | ADMIN |
| GET | `/curriculum/lessons/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PATCH | `/curriculum/lessons/{id}` | Role | ADMIN or TEACHER |
| GET | `/curriculum/steps` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/curriculum/steps` | Role | ADMIN or TEACHER |
| DELETE | `/curriculum/steps/{id}` | Role | ADMIN |
| GET | `/curriculum/steps/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PATCH | `/curriculum/steps/{id}` | Role | ADMIN or TEACHER |
| GET | `/curriculum/subtopics` | Public | No credentials |
| POST | `/curriculum/subtopics` | Role | ADMIN or TEACHER |
| DELETE | `/curriculum/subtopics/{id}` | Role | ADMIN |
| GET | `/curriculum/subtopics/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PATCH | `/curriculum/subtopics/{id}` | Role | ADMIN or TEACHER |
| GET | `/curriculum/subtopics/{id}/lessons` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/curriculum/subtopics/{id}/navigation` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/curriculum/topics` | Public | No credentials |
| POST | `/curriculum/topics` | Role | TEACHER |
| DELETE | `/curriculum/topics/{id}` | Role | ADMIN |
| PATCH | `/curriculum/topics/{id}` | Role | ADMIN |
| GET | `/curriculum/topics/{slug}` | Public | No credentials |
| GET | `/gamify/achievements/me` | Authenticated | Reads the caller's own achievements and their progress; no `userId` input exists |
| GET | `/gamify/daily-logs` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/gamify/daily-logs` | Role | ADMIN |
| GET | `/gamify/daily-logs/user/{userId}` | Owner | Owner or ADMIN of `user@param:userId` |
| GET | `/gamify/daily-logs/user/{userId}/today` | Owner | Owner or ADMIN of `user@param:userId` |
| DELETE | `/gamify/daily-logs/{id}` | Role | ADMIN |
| GET | `/gamify/daily-logs/{id}` | Owner | Owner or ADMIN of `daily-log` |
| PATCH | `/gamify/daily-logs/{id}` | Role | ADMIN |
| GET | `/gamify/leaderboards` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PUT | `/gamify/leaderboards/me` | Authenticated | The caller changes only their own board membership and handle; the body is strict |
| GET | `/gamify/leaderboards/topics/{topicId}` | Authenticated | Opt-in board per topic; shows handles and ranks, never emails |
| GET | `/gamify/leaderboards/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/gamify/me` | Authenticated | Own level, XP, stars and streak, derived from the ledger; no `userId` input exists |
| POST | `/gamify/rewards/ledger/{id}/reverse` | Role | ADMIN; body `{ reason }` (3 to 500 characters, strict); idempotent, writes a compensating ledger entry and an audit entry |
| GET | `/gamify/rewards/me` | Authenticated | Reads the caller's own ledger entries and balance; no `userId` input exists; reason, actor and keys are not returned |
| GET | `/gamify/streaks` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| GET | `/gamify/streaks/latest` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| DELETE | `/gamify/streaks/{id}` | Role | ADMIN |
| GET | `/gamify/themes/default` | Public | The default theme and its icon set; no user data |
| GET | `/gamify/themes` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/gamify/themes` | Role | ADMIN |
| POST | `/gamify/themes/icons` | Role | ADMIN |
| DELETE | `/gamify/themes/icons/{id}` | Role | ADMIN |
| DELETE | `/gamify/themes/{id}` | Role | ADMIN |
| GET | `/gamify/themes/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PATCH | `/gamify/themes/{id}` | Role | ADMIN |
| GET | `/gamify/themes/{id}/icons` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/internal/resources/callback` | Service | Signed service request (HMAC-SHA256, 60 s window, replay-protected) |
| GET | `/internal/resources/{id}` | Service | Signed service request (HMAC-SHA256, 60 s window, replay-protected) |
| GET | `/leaderboard-sse/stream` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/learner-model/me/mastery` | Authenticated | Reads the caller's own `ConceptMastery`; no `userId` input exists |
| GET | `/learner-model/me/next` | Authenticated | Computed from the caller's own `ConceptMastery`; no `userId` input exists |
| GET | `/learner-model/me/skill-nodes` | Authenticated | Derived on read from the caller's own `ConceptMastery`; no `userId` input exists |
| POST | `/learning/learning-styles` | Owner | Owner or ADMIN of `user-topic@body:userTopicId` |
| DELETE | `/learning/learning-styles/{id}` | Owner | Owner or ADMIN of `learning-style` |
| GET | `/learning/learning-styles/{id}` | Owner | Owner or ADMIN of `learning-style` |
| PATCH | `/learning/learning-styles/{id}` | Owner | Owner or ADMIN of `learning-style` |
| GET | `/learning/lesson-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/lesson-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| DELETE | `/learning/lesson-progresses/{id}` | Owner | Owner or ADMIN of `lesson-progress` |
| GET | `/learning/lesson-progresses/{id}` | Owner | Owner or ADMIN of `lesson-progress` |
| PATCH | `/learning/lesson-progresses/{id}` | Owner | Owner or ADMIN of `lesson-progress` |
| GET | `/learning/personality-quizzes` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/personality-quizzes` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| PATCH | `/learning/personality-quizzes/submit/{id}` | Owner | Owner or ADMIN of `personality-quiz` |
| DELETE | `/learning/personality-quizzes/{id}` | Owner | Owner or ADMIN of `personality-quiz` |
| GET | `/learning/personality-quizzes/{id}` | Owner | Owner or ADMIN of `personality-quiz` |
| PATCH | `/learning/personality-quizzes/{id}` | Owner | Owner or ADMIN of `personality-quiz` |
| GET | `/learning/step-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/step-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| DELETE | `/learning/step-progresses/{id}` | Owner | Owner or ADMIN of `step-progress` |
| GET | `/learning/step-progresses/{id}` | Owner | Owner or ADMIN of `step-progress` |
| PATCH | `/learning/step-progresses/{id}` | Owner | Owner or ADMIN of `step-progress` |
| GET | `/learning/subtopic-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/subtopic-progresses` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| DELETE | `/learning/subtopic-progresses/{id}` | Owner | Owner or ADMIN of `subtopic-progress` |
| GET | `/learning/subtopic-progresses/{id}` | Owner | Owner or ADMIN of `subtopic-progress` |
| PATCH | `/learning/subtopic-progresses/{id}` | Owner | Owner or ADMIN of `subtopic-progress` |
| GET | `/learning/user-steps` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/user-steps` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/user-steps/complete/{id}` | Owner | Owner or ADMIN of `user-step` |
| DELETE | `/learning/user-steps/{id}` | Owner | Owner or ADMIN of `user-step` |
| GET | `/learning/user-steps/{id}` | Owner | Owner or ADMIN of `user-step` |
| PATCH | `/learning/user-steps/{id}` | Owner | Owner or ADMIN of `user-step` |
| GET | `/learning/user-topics` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/learning/user-topics` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| DELETE | `/learning/user-topics/{id}` | Owner | Owner or ADMIN of `user-topic` |
| GET | `/learning/user-topics/{id}` | Owner | Owner or ADMIN of `user-topic` |
| PATCH | `/learning/user-topics/{id}` | Owner | Owner or ADMIN of `user-topic` |
| GET | `/material/resources` | Role | TEACHER |
| POST | `/material/resources` | Role | TEACHER |
| DELETE | `/material/resources/{id}` | Role | TEACHER |
| GET | `/material/resources/{id}` | Role | TEACHER |
| GET | `/notification-sse/stream` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/notifications` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/notifications` | Role | ADMIN |
| DELETE | `/notifications/{id}` | Owner | Owner or ADMIN of `notification` |
| GET | `/notifications/{id}` | Owner | Owner or ADMIN of `notification` |
| PATCH | `/notifications/{id}` | Owner | Owner or ADMIN of `notification` |
| GET | `/orders` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/orders` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/orders/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/orders/{id}/cancel` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/payments/intents/{intentId}` | Owner | Owner or ADMIN of `payment-intent@param:intentId` |
| GET | `/payments/manual/intents/{intentId}/submissions` | Owner | Owner or ADMIN of `payment-intent@param:intentId` |
| POST | `/payments/manual/intents/{intentId}/submissions` | Owner | Owner or ADMIN of `payment-intent@param:intentId` |
| GET | `/payments/methods` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/personality-quiz-sse` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/quiz/answers` | Owner | Owner or ADMIN of `quiz-attempt@body:attemptId` |
| DELETE | `/quiz/answers/{id}` | Owner | Owner or ADMIN of `answer` |
| GET | `/quiz/answers/{id}` | Owner | Owner or ADMIN of `answer` |
| PATCH | `/quiz/answers/{id}` | Owner | Owner or ADMIN of `answer` |
| POST | `/quiz/questions` | Role | ADMIN or TEACHER |
| DELETE | `/quiz/questions/{id}` | Role | ADMIN |
| GET | `/quiz/questions/{id}` | Owner | Owner or ADMIN of `question`; `correctAnswer` is only returned to ADMIN and TEACHER |
| PATCH | `/quiz/questions/{id}` | Role | ADMIN or TEACHER |
| POST | `/quiz/quiz-attempts` | Own rows | Query and body forced to the caller; ADMIN unrestricted |
| POST | `/quiz/quiz-attempts/start` | Authenticated | Attempt is created for the caller; a `userId` in the body is rejected (strict DTO); a quiz in someone's progress is only for that owner and a template quiz only for a learner enrolled in its topic (`QuizAccessService`, 403 `ENTITLEMENT_REQUIRED`) |
| POST | `/quiz/quiz-attempts/{id}/submit` | Owner | Owner or ADMIN of `quiz-attempt`; grading and learning events run in one transaction |
| DELETE | `/quiz/quiz-attempts/{id}` | Owner | Owner or ADMIN of `quiz-attempt` |
| GET | `/quiz/quiz-attempts/{id}` | Owner | Owner or ADMIN of `quiz-attempt` |
| PATCH | `/quiz/quiz-attempts/{id}` | Owner | Owner or ADMIN of `quiz-attempt` |
| GET | `/quiz/quiz-attempts/{id}/answers` | Owner | Owner or ADMIN of `quiz-attempt` |
| GET | `/quiz/quizs` | Role | ADMIN or TEACHER |
| POST | `/quiz/quizs` | Role | ADMIN or TEACHER |
| DELETE | `/quiz/quizs/{id}` | Role | ADMIN |
| GET | `/quiz/quizs/{id}` | Owner | Owner of the progress the quiz belongs to, or a learner enrolled in the topic of a template quiz; ADMIN and TEACHER always; the answer key is removed for everyone else |
| PATCH | `/quiz/quizs/{id}` | Role | ADMIN or TEACHER |
| GET | `/quiz/quizs/{id}/questions` | Owner | Same rule as the quiz; `correctAnswer` is only returned to ADMIN and TEACHER |
| GET | `/quiz/quizs/{id}/quiz-attempts` | Owner | Owner or ADMIN of `quiz` |
| GET | `/streak-sse` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/teacher/applications` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/teacher/applications` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/teacher/applications/{id}` | Owner | Owner or ADMIN of `teacher-application` |
| PATCH | `/teacher/applications/{id}` | Owner | Owner or ADMIN of `teacher-application` |
| POST | `/teacher/applications/{id}/approve` | Role | ADMIN |
| POST | `/teacher/applications/{id}/reject` | Role | ADMIN |
| GET | `/teacher/certifications` | Owner | Owner or ADMIN of `teacher-application@query:teacherApplicationId` |
| POST | `/teacher/certifications` | Owner | Owner or ADMIN of `teacher-application@body:teacherApplicationId` |
| DELETE | `/teacher/certifications/{id}` | Owner | Owner or ADMIN of `teacher-certification` |
| GET | `/teacher/certifications/{id}` | Owner | Owner or ADMIN of `teacher-certification` |
| PATCH | `/teacher/certifications/{id}` | Owner | Owner or ADMIN of `teacher-certification` |
| GET | `/teacher/experiences` | Owner | Owner or ADMIN of `teacher-application@query:teacherApplicationId` |
| POST | `/teacher/experiences` | Owner | Owner or ADMIN of `teacher-application@body:teacherApplicationId` |
| DELETE | `/teacher/experiences/{id}` | Owner | Owner or ADMIN of `teacher-experience` |
| GET | `/teacher/experiences/{id}` | Owner | Owner or ADMIN of `teacher-experience` |
| PATCH | `/teacher/experiences/{id}` | Owner | Owner or ADMIN of `teacher-experience` |
| GET | `/tenants/current` | Tenant | Active member of the tenant; ADMIN may act on any tenant when naming it |
| PATCH | `/tenants/current` | Tenant | Active member of the tenant with role OWNER/MANAGER; ADMIN may act on any tenant when naming it |
| GET | `/tenants/mine` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| DELETE | `/uploads` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/uploads` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/user-steps-sse` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| GET | `/users` | Role | ADMIN; query limited to `q`, `role`, `isActive`, `page`, `limit` (max 100) and `sort` (`createdAt`, `name`, `email`, `role`, with `:asc` or `:desc`); other keys are dropped, there is no `include`, the password hash is never selected |
| POST | `/users` | Role | ADMIN |
| DELETE | `/users/{id}` | Role | ADMIN |
| GET | `/users/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| PATCH | `/users/{id}` | Authenticated | Any signed-in user; row-level rules enforced in the service |
| POST | `/users/{id}/activation` | Role | ADMIN |
| POST | `/users/{id}/role` | Role | ADMIN |
| POST | `/webhooks/payments/{provider}` | Public | No credentials |

## Internal routes for `ai-api` (added 2026-10-09, not yet in the counts above)

The counts above predate these routes and omit the other internal controllers (`episodes`, `decision-traces`, `agent-sessions`, `credits`); a full regeneration is task SP-020 of the progress tracker. Design: [ai-api-service-identity.md](./ai-api-service-identity.md).

Decision names used here: **Service** is `@InternalOnly()` (signed service identity only). **Service + acting user** is `@InternalActing()`: signed service identity, then `ActingUserGuard` loads the user named in `x-acting-user-id` (400 without it, 403 when unknown or inactive) and applies the stated ownership rule with no `ADMIN` bypass. Writes also require `x-idempotency-key`, and a repeated key replays the first response.

| Method | Path | Decision | Rule |
|---|---|---|---|
| GET | `/internal/lessons/{id}` | Service | Curriculum is platform-global |
| GET | `/internal/steps` | Service | Curriculum is platform-global |
| GET | `/internal/steps/{id}` | Service | Curriculum is platform-global |
| GET | `/internal/user-steps/{id}` | Service + acting user | Acting user owns the step |
| GET | `/internal/learning-styles/{id}` | Service + acting user | Acting user owns the profile |
| GET | `/internal/personality-quizzes` | Service + acting user | `userId` query is the acting user or absent, otherwise 403 |
| GET | `/internal/contents/similarity` | Service + acting user | Acting user owns the chat named by `chatId` |
| GET | `/internal/concepts` | Service | Concept registry is platform-global: active concepts, prerequisites and approved `PYTHON_DOMAIN` aliases |
| GET | `/internal/learner-state` | Service + acting user | Reads only the acting user's `ConceptMastery`; a `userId` query is ignored; `lessonId`, `conceptId` and `userStepId` (resolved only for a user step the acting user owns) choose the concepts |
| PATCH | `/internal/chat-messages/{id}` | Service + acting user | Acting user owns the message; body `{ text, status? }`, other fields 400 |
| POST | `/internal/contents` | Service + acting user | Acting user owns the chat named in the body; unknown fields 400 |
| POST | `/internal/personality-quizzes` | Service + acting user | Body `userId` is the acting user or absent, otherwise 403 |

## Routes added 2026-10-11 (not yet in the counts above)

| Method | Path | Decision | Detail |
|---|---|---|---|
| GET | `/admin/audit-logs` | Role | ADMIN; filters `action`, `entityType`, `entityId`, `actorId` (uuid), `from`, `to` (from not after to), `page`, `limit` (max 100); unknown query keys are dropped, never passed to the database; rows carry no `before` or `after` |
| GET | `/admin/audit-logs/actions` | Role | ADMIN; distinct action names for the filter |
| GET | `/admin/audit-logs/{id}` | Role | ADMIN; the only route that returns the `before` and `after` payload |
| GET | `/marketplace/articles/{id}/preview` | Public | Published article of an active tenant only; returns at most the first 600 characters cut at a paragraph boundary plus word count and reading minutes, never the rest of the body; a paid article never shows more than half of its text, so a short paid article is not readable in full from the preview |
| GET | `/curriculum/lessons/{id}/prev` | Authenticated | The lesson before this one in the same sub-topic, with `completed` for the caller only |
| GET | `/curriculum/lessons/{id}/next` | Authenticated | The lesson after this one in the same sub-topic, with `unlocked` true only when the caller finished the current lesson |

Removed 2026-10-11: `/admin/moderation/*` (`pending`, `articles|classes/{id}/approve|reject`). It let an ADMIN or REVIEWER publish or reject any article or class from any state, without the state table, version publishing, tenant checks, audit entry or idempotency. Moderation now goes only through the `admin/articles` and `admin/classes` intent endpoints, which are ADMIN only.
