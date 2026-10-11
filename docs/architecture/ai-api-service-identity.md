# ai-api Service Identity and Internal Contract

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> How every `ai-api` → `api` call carries a signed service identity and an acting user that `api` re-authorizes, replacing the forwarded user token.

Decision source: Q-03 of [implementation-readiness.md](../01-audit/implementation-readiness.md), accepted by the owner on 2026-10-09 through [ADR-007](../decisions/ADR-007-ai-api-service-boundary.md). This document is the Phase 3 design for finding C-001 (audit row 1d) and the identity part of row 1e. The executable tasks are in [ai-api-service-identity-plan.md](../plans/ai-api-service-identity-plan.md).

---

## Purpose

Describes the contract between `ai-api` (and `celery-worker`) and the `api` for reading learner and curriculum data and for writing chat and quiz records on behalf of one learner.

In scope: the direction `ai-api` → `api`. Out of scope, each with its own owner decision:

| Not covered | Why | Tracked as |
|---|---|---|
| `api` → `ai-api` calls (BullMQ jobs carried the user's bearer token in Redis) | different direction | closed on 2026-10-09 by [api-to-ai-api-service-identity.md](./api-to-ai-api-service-identity.md), ADR-013 |
| Real tenant id in agent sessions | `deriveTenant` hashes the user id | H-012, audit row 1i |
| Tool registry and agent runtime calls made with a user token (`v1/agents/`) | depends on the agent runtime design | audit row 6 |
| Environment allow-lists per container | compose change, not an HTTP contract | Q-06, audit row 1f |

## Call inventory

Measured on `HEAD cb0572f` plus the working tree of 2026-10-09. "Sent today" is read from the request code; no request was replayed against a live stack for this table.

| # | ai-api function | Request | Sent today | Outcome at `api` | Access decision at `api` | Target |
|---|---|---|---|---|---|---|
| 1 | `learning/service.py:122` `update_message_chat` | `PATCH /chat/chat-messages/:id` | acting-user, trace, idempotency headers only | rejected by `JwtAuthGuard` (no token) | `@RequireOwnership('message')` | `PATCH /internal/chat-messages/:id` |
| 2 | `learning/service.py:145` `create_message_chat` | `POST /chat/chat-messages` | same | rejected; the function has no caller | `@RequireParentOwnership('chat','chatId')` | none: delete the function, add no route |
| 3 | `learning/service.py:168` `query_content_history` | `GET /chat/contents/similarity` | same | rejected | `@RequireParentOwnership('chat','chatId','query')` | `GET /internal/contents/similarity` |
| 4 | `learning/service.py:191` `get_lesson` | `GET /curriculum/lessons/:id` | same | rejected | `@AuthenticatedOnly()` | `GET /internal/lessons/:id` |
| 5 | `learning/service.py:212` `get_user_step` | `GET /learning/user-steps/:id` | same | rejected | `@RequireOwnership('user-step')` | `GET /internal/user-steps/:id` |
| 6 | `learning/service.py:233` `create_content_material` | `POST /chat/contents` | same | rejected | `@RequireParentOwnership('chat','chatId')` | `POST /internal/contents` |
| 7 | `users_steps/service.py:72` `get_steps` | `GET /curriculum/steps?lessonId=` | same | rejected | `@AuthenticatedOnly()` | `GET /internal/steps` |
| 8 | `users_steps/service.py:81` `get_step` | `GET /curriculum/steps/:id` | same | rejected | `@AuthenticatedOnly()` | `GET /internal/steps/:id` |
| 9 | `users_steps/service.py:87` `get_topic` | `GET /curriculum/topics?id=` | same | served (route is `@Public()`) | `@Public()` | unchanged route, sent through the signing client |
| 10 | `users_steps/service.py:96` `get_learning_style` | `GET /learning/learning-styles/:id` | same | rejected | `@RequireOwnership('learning-style')` | `GET /internal/learning-styles/:id` |
| 11 | `users_steps/service.py:106` `create_personality_quiz` | `POST /learning/personality-quizzes` | same | rejected | `@ScopeToUser()` | `POST /internal/personality-quizzes` |
| 12 | `users_steps/service.py:114` `get_personality_quiz` | `GET /learning/personality-quizzes?lessonId=&userId=` | same | rejected | `@ScopeToUser()` | `GET /internal/personality-quizzes` |
| 13 | `episodes/service.py:25` `write_episode` | `POST /internal/episodes` | adds `x-service-id`, no timestamp, no signature | rejected by `InternalServiceGuard` ("Service credentials required") | `@InternalOnly()` | same route, signed |
| 14 | `decision_traces/service.py:30` `write_decision_trace` | `POST /internal/decision-traces` | adds `x-service-id`, no timestamp, no signature | rejected | `@InternalOnly()` | same route, signed |
| 15 | `resources/service.py:18,28` `get_resource`, `callback_resource` | `/internal/resources/*` | signed with `send_signed` | accepted | `@InternalOnly()` | already migrated |
| 16 | `resources/service.py:52` `get_content` | `GET /contents/:id` with the user's bearer | token forwarded | route does not exist; function has no caller | none | delete |

Evidence: `services/ai-api/v1/users_steps/service.py:23-28`, `services/ai-api/v1/learning/service.py:122-253`, `services/ai-api/v1/episodes/service.py:35-41`, `services/ai-api/v1/decision_traces/service.py:40-45`, `services/ai-api/v1/resources/service.py:14-57`, `services/api/src/common/authz/internal-service.guard.ts:44-104`. Controllers: `services/api/src/v1/curriculum/{lessons,steps,topics}/*.controller.ts`, `services/api/src/v1/learning/{learning-styles,personality-quizzes}/*.controller.ts`, `services/api/src/v1/chat/{chat-messages,contents}/*.controller.ts`.

Dead code in the same module: `_signed_get`, `_signed_post` and `_signed_patch` (`learning/service.py:20-119`) have no caller, and `_signed_patch` cannot work (M-012).

## Conceptual model

```mermaid
sequenceDiagram
    participant U as Browser
    participant A as ai-api
    participant G as api: InternalServiceGuard
    participant P as api: ActingUserGuard
    participant C as api: internal controller
    participant D as PostgreSQL

    U->>A: user request with user token
    A->>A: authenticated_user (GET /auth/profile on api), bind_acting_user
    A->>G: signed request: x-service-id, timestamp, signature, x-acting-user-id, x-trace-id, x-idempotency-key
    G->>G: secret known, clock window, HMAC, idempotency key on mutations, replay cache
    G->>P: req.internalCaller
    P->>D: load acting user (exists, active)
    P->>P: req.user = acting user; ownership policy without ADMIN bypass
    P->>C: authorized request
    C->>D: same service call as the user-facing controller
    C-->>A: same response envelope as the user-facing route
```

Guard chain on an internal route that touches learner data:

| Order | Guard | Source | Result on internal route |
|---|---|---|---|
| 1 | `JwtAuthGuard` (global) | `app.module.ts:57-60` | skipped, `@InternalOnly()` sets `IS_PUBLIC_KEY` |
| 2 | `RolesGuard` (global) | `app.module.ts:61-64`, `roles.guard.ts:15-22` | no `@Roles` metadata, passes |
| 3 | `OwnershipGuard` (global) | `app.module.ts:65-68` | no `@RequireOwnership` metadata on internal routes, passes |
| 4 | `IdempotencyKeyGuard` (global) | `app.module.ts:69-72`, `idempotency-key.guard.ts:14-30` | where `@RequireIdempotencyKey()` is present, checks that the `Idempotency-Key` header has at least 8 characters; it does not deduplicate |
| 5 | `InternalServiceGuard` (route) | `internal-service.guard.ts:44-104` | verifies the service |
| 6 | `ActingUserGuard` (route, new) | this document | resolves and authorizes the acting user |

Global guards run before route guards in Nest, so internal routes cannot carry `@RequireOwnership`: the global `OwnershipGuard` would read `req.user`, which does not exist yet, and throw "Authentication required" (`ownership.guard.ts:40`). Ownership on internal routes therefore uses its own decorator, evaluated by `ActingUserGuard` after step 5.

Deduplication of retried writes is a separate mechanism. `IdempotencyService.execute` (`common/idempotency/idempotency.service.ts`) stores the response per `(key, userId)` for 24 hours and rejects a reused key with a different body, but no controller calls it today: `internal-episodes.controller.ts:66` injects the service and never uses it, and a search of `services/api/src` outside specs finds no other caller. The internal write routes below are its first callers.

## Schema

Request contract (unchanged headers, `x-acting-user-id` becomes mandatory on learner routes):

```text
x-service-id          "ai-api"
x-service-timestamp   epoch milliseconds, within 60 s of the api clock
x-service-signature   hex HMAC-SHA256(secret, canonicalString)
x-trace-id            propagated from the originating request
x-idempotency-key     mandatory for every method except GET and HEAD
x-acting-user-id      the authenticated learner; mandatory on routes under @InternalActing()
```

Canonical string, current form (`internal-signature.ts:18-24`, `service_auth.py:23-29`):

```text
timestamp \n METHOD \n target(path+query) \n sha256(rawBody)
```

Amendment A1 (approved by the owner on 2026-10-09, implemented): sign the acting user so the header cannot be swapped in transit.

```text
timestamp \n METHOD \n target(path+query) \n sha256(rawBody) \n actingUserId   # empty string when absent
```

New api decorators and types:

```typescript
export interface InternalCaller {
  serviceId: string;
  traceId: string | null;
  idempotencyKey: string | null;
  actingUserId: string | null;
}

export const InternalActing: () => MethodDecorator & ClassDecorator;

export const InternalOwnership: (
  resource: OwnedResource,
  options?: { field?: string; source?: 'param' | 'body' | 'query' },
) => MethodDecorator;

export interface OwnershipDecision {
  actor: { id: string; role: string };
  metadata: OwnershipMetadata;
  carrier: Record<string, unknown>;
  allowAdminBypass: boolean;
}
```

`InternalActing()` = `InternalOnly()` plus `UseGuards(ActingUserGuard)`. `InternalOwnership()` stores metadata under its own key (`internal-ownership:resource`) so the global `OwnershipGuard` never sees it.

Python client, one entry point for all calls:

```python
class InternalApiClient:
    def __init__(self, session: AgentSession): ...
    def send(self, method: str, path: str, *, params: dict | None = None, json_body: dict | None = None) -> dict: ...
    def get(self, path: str, *, params: dict | None = None) -> Any: ...
    def post(self, path: str, *, json_body: dict) -> Any: ...
    def patch(self, path: str, *, json_body: dict) -> Any: ...
```

`send` returns the whole envelope; `get`, `post` and `patch` return its `data`. Each call signs with `send_signed`, sets `acting_user_id` and `trace_id` from the `AgentSession`, and maps statuses as follows. A write carries a per-operation idempotency key, `sha256(session key, method, path, canonical body)`, not the session key itself: one Celery task performs many writes under one session key (`update_message_chat` alone is called about ten times per material), and with the session key every second write would be rejected as a reuse with another body or replayed as a duplicate. The same operation retried inside the same request derives the same key and is replayed; the same body sent under a new request key is a new operation.

| Status from api | Raised in ai-api |
|---|---|
| network error, timeout, ≥ 500 | `CrossServiceError` |
| 401 | `CrossServiceError` with `details.reason = "service_credentials_rejected"` (a configuration fault, not a user error) |
| 403 | `AuthError` |
| 404 | `CrossServiceError` with `details.status = 404` |

Internal routes and their authorization (all return the same envelope as the user-facing route, so the Python parsers do not change):

| Route | Decorators | Authorization |
|---|---|---|
| `GET /internal/lessons/:id` | `@InternalOnly()` | service identity only; curriculum is platform-global ([ADR-001](../decisions/ADR-001-multi-tenancy-model.md)) |
| `GET /internal/steps`, `GET /internal/steps/:id` | `@InternalOnly()` | same |
| `GET /internal/user-steps/:id` | `@InternalActing()`, `@InternalOwnership('user-step')` | acting user owns the step |
| `GET /internal/learning-styles/:id` | `@InternalActing()`, `@InternalOwnership('learning-style')` | acting user owns the style |
| `GET /internal/personality-quizzes` | `@InternalActing()` | `userId` query must equal the acting user, otherwise 403 |
| `POST /internal/personality-quizzes` | `@InternalActing()`, `@RequireIdempotencyKey()`, `IdempotentWriteInterceptor` | body `userId` is the acting user or absent; a different value is 403 |
| `GET /internal/contents/similarity` | `@InternalActing()`, `@InternalOwnership('chat', { field: 'chatId', source: 'query' })` | acting user owns the chat |
| `POST /internal/contents` | `@InternalActing()`, `@InternalOwnership('chat', { field: 'chatId', source: 'body' })`, `@RequireIdempotencyKey()`, `IdempotentWriteInterceptor` | acting user owns the chat |
| `PATCH /internal/chat-messages/:id` | `@InternalActing()`, `@InternalOwnership('message')`, `@RequireIdempotencyKey()`, `IdempotentWriteInterceptor` | acting user owns the message |

Write DTOs are the user-facing Zod schemas made `.strict()` per `AGENTS.md:111-115` (`UpdateChatMessageDto`, `CreateContentDto`, and `CreatePersonalityQuizDto` with `userId` optional). The ai-api payloads were checked against them: `{text, status}` for message updates, `{chatId, chatMessageId, data, citations, metadata}` for content, and the five quiz fields. `CreateContentDto.citations` accepted only `string[]` or a record, while ai-api sends a list of objects (`CitationDto`), so the shared schema is widened to accept a list of strings or objects; the column is `Json?`. `IdempotentWriteInterceptor` (`common/idempotency/`) runs the handler inside `IdempotencyService.execute`, which needs `req.user.id` (set by `ActingUserGuard`) and reads the key from the `idempotency-key` header, which `send_signed` sends next to `x-idempotency-key`. The write handlers also emit the same SSE events as the user-facing routes, because the web refreshes from them; they do not use `ActivityDetectorInterceptor`, so a message written by the AI service does not credit the learner's streak.

## Algorithms

Verification order inside `InternalServiceGuard` (already implemented, unchanged by this design):

1. `x-service-id`, timestamp and signature present, else 401.
2. Secret for the service id configured (`INTERNAL_AI_API_SECRET`), else 401 (fails closed).
3. `|now - timestamp| ≤ 60 s`, else 401.
4. Recompute the HMAC over the raw body (`req.rawBody`) and `req.originalUrl`; constant-time compare, else 401.
5. Non-GET requires `x-idempotency-key`, else 401.
6. Replay cache: `SET internal:replay:<serviceId>:<signature> NX EX 120` in Redis; a repeat is 401. When Redis is unreachable the guard logs a warning and lets the request through (`internal-service.guard.ts:106-119`).

`ActingUserGuard` (new):

```text
caller = req.internalCaller
if caller.actingUserId is null            -> 400 ACTING_USER_REQUIRED
user = findUnique(User, caller.actingUserId)
if user is null or not active             -> 403
req.user = { id: user.id, role: user.role }
metadata = reflector.get('internal-ownership:resource')
if metadata is absent                     -> allow
assertOwnership({ actor: req.user, metadata, carrier, allowAdminBypass: false })
```

`assertOwnership` is extracted from `OwnershipGuard.canActivate` (`ownership.guard.ts:28-78`) so both guards share one decision function; the extraction keeps the user-facing behavior byte for byte, and the new parameter `allowAdminBypass` is `true` for the user-facing guard and `false` for internal routes.

`IdempotencyService.execute` reads the stored key, runs the work, then inserts the key; it is not atomic. Two requests with the same key arriving together both run the work and the second insert fails with 500 "Failed to record idempotency key". Celery retries are sequential, so the case is rare, but the guarantee is "replay after completion", not "exactly once under concurrency". An atomic claim (insert first, as in the ai-api store of RC-03) is a separate change to the shared service.

Edge cases:

| Case | Behavior |
|---|---|
| Acting user is an `ADMIN` | no ownership bypass on internal routes; the AI service acts as an owner, never as an administrator |
| Resource does not exist | 403 "Resource not found", same masking as the user-facing guard (`ownership.guard.ts:57,63`) |
| `userId` in query or body differs from the acting user | 403, never silently replaced on GET; on POST the body value is set to the acting user only when it was absent |
| Same mutation retried by Celery | new timestamp and signature (so the replay cache does not reject it), same `x-idempotency-key`; `IdempotencyService.execute` returns the stored response, so the record is written once. A retry with a different body is 400 |
| Clock skew above 60 s | 401 on every call; surfaces as `service_credentials_rejected` in ai-api logs |
| Secret missing on either side | `send_signed` raises `RuntimeError` in ai-api; the api guard answers 401 "Unknown service" |

## Trade-offs

| Decision | Chosen | Alternatives and why not |
|---|---|---|
| Where acting-user resolution lives | route-level `ActingUserGuard` after `InternalServiceGuard` | A global identity guard between `JwtAuthGuard` and `RolesGuard` would let internal routes reuse `@RequireOwnership` and `@ScopeToUser` unchanged, but it changes the global chain for every route and for the five internal controllers already in use. Revisit if the number of internal routes passes about 30 |
| Ownership reuse | extract `assertOwnership` and call it from both guards | Copying the guard body into a second guard duplicates the 60 lines that decide access and lets the two drift |
| ADMIN bypass | none on internal routes | Keeping the bypass means a compromised or mistaken `ai-api` that names an admin gains admin reach. `AGENTS.md:150` states the AI service gains no privileges from internal calls |
| Signing the acting user (A1) | adopted 2026-10-09 | Without it, a party that can alter a request in transit but lacks the secret can swap `x-acting-user-id` while the signature stays valid. Traffic is on the Docker network without TLS. Cost: both languages change `canonicalString`, the shared vectors change, and both services deploy together |
| Route per resource | one internal route per read or write the AI service needs | A generic `/internal/proxy` that forwards to user-facing routes would reuse authorization but turns the internal contract into an open door, and user-facing routes do not accept signed identity |
| Topics | stay on the public route | A copy under `/internal/topics` adds a route with no authorization difference (`@Public()`) |
| Agent sessions store | not used by these calls | `internal/agent-sessions` keeps sessions in a process-memory `Map` and trusts `acting_user_id` from the body without loading the user (`internal-agent-sessions.controller.ts:35-60`); the per-call header with a loaded user is stronger |
| mTLS instead of HMAC | not chosen | Needs certificate issuance and rotation in compose; the HMAC scheme exists in both languages with shared vectors |

## Migration notes

What changes on top of the current system:

- **api**: new `ownership.policy.ts`, `ActingUserGuard`, two decorators, `IdempotentWriteInterceptor`, `ContentSimilarityService` (the similarity ranking moved out of `ContentsController`, behavior unchanged and covered by its existing spec), three internal controllers (curriculum, learner reads, learner writes). The only change to an existing contract is the wider `citations` type of `CreateContentDto`. The route-access ratchet (`route-access.spec.ts`) requires each new route to declare its decision; `@InternalOnly()` and `@InternalActing()` both set `ACCESS_KEY = 'internal'`.
- **ai-api**: new `config/internal_client.py`; `users_steps/service.py` and `learning/service.py` lose their hand-built headers; `episodes/service.py` and `decision_traces/service.py` stop building headers by hand; `_signed_*`, `create_message_chat` and `resources.get_content` are deleted (none has a caller).
- **Rule files**: `AGENTS.md` still says the token is forwarded (cross-service rules 1 and 5, `AGENTS.md:184-192`), still says "Open violations: none" (`:213`), and still says the replay cache is process memory (`:151`) while the guard uses Redis. ADR-007 lists the same stale replay-cache consequence. These are owner edits; the plan lists the exact lines and does not change them.
- **Environment**: `INTERNAL_AI_API_SECRET` must reach `api`, `ai-api` and `celery-worker`. Q-06 (per-service allow-lists) will make that explicit; today every container receives every secret.
- **Order of rollout**: api routes first (additive, unused), then the ai-api client behind the same commit that switches the callers, then deletion of dead code. A1, if confirmed, ships last and needs api and ai-api deployed together.
- **Latent contract faults found while migrating** (all hidden until now because every call was rejected with 401 first): `CreateContentDto.citations` rejected the list of objects that ai-api sends (widened); the episode and decision-trace bodies were sent camelCase with `createdAt` and `null` values to `.strict()` snake_case schemas that allow neither (the writers now send snake_case without `created_at` and without nulls, and only the nested `citations` keep camelCase); `EpisodeCreate.created_at` is a `datetime` that `requests` could not serialize (now `mode="json"`); episode and decision-trace calls sent `x-idempotency-key` but not the `Idempotency-Key` header that `IdempotencyKeyGuard` requires (the client sends both); `query_content_history` read `data.data` from a response whose `data` is already the list, and the pipeline read a `chunkText` key the api never returns (the api key is `text`).
- **Behavior change to expect**: today every call in rows 1-12 fails, and some callers swallow the failure (M-005, H-001). After the migration those calls succeed, so the tutor, path generation and quiz flows start doing the work they were written to do. Latency and LLM cost per request rise accordingly.

## Evidence citations

- `services/api/src/common/authz/internal-service.guard.ts:32-126`, `internal-signature.ts:1-33`
- `services/api/src/app.module.ts:57-72`, `services/api/src/v1/common/guards/ownership.guard.ts:22-79`, `ownership.registry.ts:60-119`
- `services/api/src/common/idempotency/{idempotency.service.ts,idempotency-key.guard.ts,require-idempotency-key.decorator.ts}`, `services/api/src/v1/internal/internal-episodes.controller.ts:66`
- `services/api/src/v1/internal/internal-agent-sessions.controller.ts:35-60,111-113`
- `services/ai-api/config/service_auth.py:1-95`, `services/ai-api/v1/**/service.py` as listed in the inventory
- `AGENTS.md:111-115,146-151,184-192,213`, [ADR-007](../decisions/ADR-007-ai-api-service-boundary.md), [security-audit.md](../01-audit/security-audit.md#c-001)
