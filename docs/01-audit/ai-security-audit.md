# AI Security Audit — services/ai-api × services/api signed contract

**Scope:** Master prompt §3.3, §22, §23, §91, §92, INDEX. Cross-service depth: `services/ai-api` and the `InternalServiceGuard` boundary into `services/api` only.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003 (FastAPI) and `reducera_api` :3002 (NestJS, verifier).
**Evidence rule:** every claim cites a file and line range, or is marked `MISSING` / `N/A`.

---

## 1. Headline Verdict

The signed internal contract is **partially hardened**. The HMAC scheme matches across `services/ai-api` (`config/service_auth.py`) and `services/api` (`internal-service.guard.ts` + `internal-signature.ts`); the verifier enforces a 60s clock skew window, requires `x-idempotency-key` for non-GET methods, and uses `timingSafeEqual` for signature comparison. Replay protection exists but is **in-process** (`Map<string, number>` with 120s TTL), so it fails as soon as the api runs in >1 replica — the same header pair will be accepted by a second replica. The known critical defect is the **bearer token forwarded into the Celery payload**: `state.token` and `payload["token"]` are serialized into the Redis broker (Celery broker is Redis per `config/celery.py`). The api-side `IdempotencyKey` model has a composite `(key, userId)` primary key, so the agent's `f"{userId}:{intent}:{idempotency_key}"` derivation is bounded per user. CORS, trace-id validation, and external-content segmentation are weaker than the master prompt requires.

---

## 2. HMAC Canonical String (signer + verifier)

| Item | Status | Evidence |
|---|---|---|
| Signer uses HMAC-SHA256 over `(timestamp, method, target, sha256(body))` | PRESENT | `services/ai-api/config/service_auth.py:22-28` |
| Verifier uses the same canonical form | PRESENT | `services/api/src/common/authz/internal-signature.ts:18-24` |
| Verifier recomputes signature and compares with `timingSafeEqual` | PRESENT | `services/api/src/common/authz/internal-service.guard.ts:72-81`; `internal-signature.ts:26-33` |
| `target` is path + query (not full URL) | PRESENT | signer: `service_auth.py:81` (`prepared.path_url`); verifier: `internal-service.guard.ts:76` (`req.originalUrl`) |
| Body is the raw HTTP body, not re-serialized | PARTIAL | signer uses `prepared.body` (line 75, the same bytes that will be sent); verifier uses `req.rawBody` (line 71, NestJS `rawBody:true` required) — equivalence depends on `rawBody` capture in NestJS bootstrap. **If `rawBody` is not preserved in `main.ts`, the verifier sees `Buffer.alloc(0)` and signatures will mismatch for POSTs.** Audit scope here did not verify `main.ts`; flagging as risk. |
| `method` is uppercased before signing | PRESENT | `service_auth.py:23`; `internal-signature.ts:21` |
| `timestamp` is `int(time.time() * 1000)` (milliseconds) on signer; parsed as `Number` on verifier | PRESENT | `service_auth.py:49`; `internal-service.guard.ts:66-67` |
| Replay protection key is `${serviceId}:${providedSignature}` | PRESENT | `internal-service.guard.ts:88` |
| `idempotency-key` required for non-GET, non-HEAD | PRESENT | `internal-service.guard.ts:84-86` |
| Signature tested against same secret on both sides | PRESENT | `service_auth.py:31-33`; `internal-service.guard.ts:24-26, 60-64` |

---

## 3. Replay Protection, Clock Skew, Timestamp Monotonicity

| Item | Status | Evidence |
|---|---|---|
| Replay window: 120s (`REPLAY_WINDOW_MS`) | PRESENT | `internal-service.guard.ts:29, 108` |
| Replay cache is in-process `Map<string, number>` | **FLAWED for >1 replica** | `internal-service.guard.ts:42, 100-109` — confirmed by `AGENTS.md` §API Architecture "replay cache is in-process memory (single-replica safe); multi-replica deployments must move it to Redis" |
| Stale-after `MAX_CLOCK_SKEW_MS = 60_000` | PRESENT | `internal-service.guard.ts:28, 67` — `Math.abs(Date.now() - issuedAt) > MAX_CLOCK_SKEW_MS` rejects stale or far-future timestamps |
| Reaper purges expired entries from the in-memory map | PRESENT but **O(n) per request** | `internal-service.guard.ts:102-104` — linear scan of the whole map on every call; safe for a few hundred services but degrades with high traffic |
| Future-dated signature within 60s accepted | PRESENT (per `Math.abs`) | `internal-service.guard.ts:67` — a clock-skewed attacker 60s in the future can sign and replay; the same `abs()` window also catches it |
| Timestamp monotonicity enforced (older signatures rejected) | **MISSING** | `internal-service.guard.ts:67` only checks skew, not monotonicity. A future-dated signature 60s ahead is treated identically to a current one. With a 60s future window an attacker can pre-sign traffic and replay it. |
| Per-service replay window configurable per `serviceId` | **MISSING** | `internal-service.guard.ts:29` — single `REPLAY_WINDOW_MS` constant |

---

## 4. Idempotency-Key Collision Risk

| Item | Status | Evidence |
|---|---|---|
| `Idempotency-Key` required on `/v1/agents/run` (>=8 chars) | PRESENT | `services/ai-api/v1/agents/router_endpoint.py:27-35` |
| ai-api derives composite key: `f"{req.userId}:{req.intent}:{idempotency_key}"` | PRESENT | `services/ai-api/v1/agents/router_endpoint.py:36` |
| ai-api forwards the composite to api as `x-idempotency-key` | PRESENT | `services/ai-api/v1/agents/router_endpoint.py:80` |
| api-side dedup table `IdempotencyKey` exists | PRESENT | `services/api/prisma/schema.prisma:1075-1089` |
| api-side composite primary key `(key, userId)` | PRESENT | `services/api/prisma/schema.prisma:1086` — `@@id([key, userId])` |
| Migration that creates the table | PRESENT | `services/api/prisma/migrations/20260115090000_idempotency_key/migration.sql:1-20` |
| `expiresAt` column with `@@index` (TTL-aware) | PRESENT | `schema.prisma:1088`; migration `:18` |
| Internal `InternalServiceGuard` consults the `IdempotencyKey` table for dedup | **MISSING** | `internal-service.guard.ts:46-98` — guard only checks header is *present* for mutations; the actual dedup happens in `IdempotencyService.execute` further down the pipeline (not in this audit's scope) |
| Idempotency-Key required on `/v1/learning/*` and `/v1/users-steps/*` | **MISSING** | `v1/learning/router.py:12-60`, `v1/users_steps/router.py:21-131` — no `Idempotency-Key` validation; `learning/chat` and `learning/generate-material` even lack role/ownership checks. Confirmed in foundation audit §8. |
| Idempotency-Key required on `/v1/resources/extract` and `/v1/resources/embedding/{id}` | **MISSING** | `v1/resources/router.py:13-44` — no header check; these are the only routes that the api treats as `InternalOnly` on inbound (api's `resources.callback` controller) |

---

## 5. Bearer-Token Lifecycle (CRITICAL)

This is the central defect. The flow:

1. Browser → `nginx` → `services/ai-api` (bearer in `Authorization`)
2. `services/ai-api` routes call `state.token = token` after stripping `Bearer `, then `.delay(state.dict())` enqueues to Celery
3. Celery broker is Redis → token sits in cleartext in the queue
4. Celery worker deserializes the task, calls `services/api` with the bearer, which verifies the bearer

| Item | Status | Evidence |
|---|---|---|
| `Authorization` header required on `/v1/learning/*` | PRESENT | `v1/learning/router.py:14, 42` |
| `Authorization` header required on `/v1/users-steps/*` (SSE path) | PARTIAL | `v1/users_steps/router.py:21-90` — bearer passed as `?token=` query param on `GET /generate-question`; logs the token in URL (line 9) |
| `Authorization` header checked on `/v1/users-steps/generate` | **MISSING** (dead code) | `v1/users_steps/router.py:92-131` — the bearer check is at lines 111-115, **after** the early `return` on line 109. Foundation audit §11 already flagged this. |
| Bearer stored in Pydantic state: `state.token = token` | PRESENT | `v1/learning/router.py:19, 46` |
| State dict forwarded to Celery: `task = ...task.delay(state.dict())` | PRESENT | `v1/learning/router.py:22, 47`; `v1/learning/workers.py:20` |
| Worker reads `state.token` from payload and forwards to api | PRESENT | `v1/learning/workers.py:23, 29, 53, 65, 87, 90`; `v1/users_steps/workers.py:38` |
| Celery broker URL is Redis | PRESENT | `services/ai-api/config/celery.py:11-15` (`CELERY_BROKER_URL` falls back to `REDIS_URL`); `config/envs.py:60-61` |
| **Bearer token therefore persists in cleartext in the Redis broker** | **CRITICAL** | implied by 1-5 above. Master prompt §3.3: "Never expose internal privileged AI operations as public unauthenticated APIs" + §22: "Strip Bearer from Celery payload; pass service identity + acting user + idempotency key only" |
| Bearer in Celery result backend (Redis) | PRESENT (defect) | `config/celery.py:18-22` (result backend = Redis) — any task that returns a result also serializes its argument history, including `state.token`. |
| SSE path leaks token in URL (`?token=...`) | PRESENT (defect) | `v1/users_steps/router.py:22, 27, 37, 42, 43, 48` — token appears in URL and in `logging.info` lines 9, 44, 68, 77 |
| Log lines include token | PARTIAL | no `print(token)` / `logger.info(token)` in ai-api code. But `state.userStep` is `print()`-ed at `v1/learning/content_pipeline.py:42` and `v1/learning/service.py:106` — these are user-step objects, not the token, so the token is not directly logged. |
| Qdrant memory collection receives bearer-bearing text | **NOT TRIGGERED in current code** | `tool_memory_upsert` (`utils/tools/memory.py:81-100`) is the only place memory writes happen with `looks_like_instruction` filter; `EmbeddingPipeline.upsert_document` (`config/embedding_pipeline.py:200-230`) accepts arbitrary `content` and metadata. Neither receives `state.token` as a payload. **Risk: future callers can pass token-bearing text.** |
| Qdrant embeddings collection receives bearer-bearing text | **NOT TRIGGERED in current code** | `v1/learning/workers.py:65-75` (`get_propmpt_material`) writes `query` (user input) and `rag`/`web` (retrieved content) to LLM but does not write to Qdrant. `v1/learning/content_pipeline.py:84, 242-249` writes `analysis` and `content` (LLM outputs) to memory via `tool_memory_upsert`. None of these contain the bearer. |
| Authorization header is forwarded verbatim from inbound to outbound cross-service calls | PRESENT | `v1/learning/service.py:15, 25, 42, 55, 67, 79`; `v1/users_steps/service.py:8, 19, 31, 43, 56, 75` — the `Authorization: Bearer <token>` is sent to api unchanged |
| AI service never re-validates the bearer | PRESENT | `v1/learning/router.py`, `v1/users_steps/router.py` — no `authenticate()` call; the api is the verifier |

---

## 6. Trace-ID Injection

| Item | Status | Evidence |
|---|---|---|
| Outbound `x-trace-id` always set by `signed_headers` | PRESENT | `services/ai-api/config/service_auth.py:54` — `headers[TRACE_ID_HEADER] = trace_id or str(uuid.uuid4())`. Outbound trace_id is **never** taken from the inbound request, it is either the explicit `trace_id` argument or auto-uuid4. So a client of ai-api cannot inject a trace_id into the outbound signed call. |
| Incoming `x-trace-id` on ai-api routes is never read | PRESENT | `v1/learning/router.py`, `v1/users_steps/router.py`, `v1/agents/router_endpoint.py` — no `request.headers.get("x-trace-id")` anywhere |
| api-side `TraceId` decorator caps trace_id at 128 chars | PRESENT | `services/api/src/common/authz/trace-id.decorator.ts:7` — `incoming.length <= 128` |
| api-side guard stores trace_id raw on `req.internalCaller.traceId` | PRESENT | `internal-service.guard.ts:90-95` — no character validation (newline, CR, control bytes) |
| Trace_id length cap (128) prevents OOM but not log injection | PARTIAL | `trace-id.decorator.ts:7` — CR/LF not filtered; an attacker can send `x-trace-id: foo\r\n2026-10-05 ...` to forge log lines that use `%s` formatting. **Out of ai-api scope but the api's `InternalServiceGuard` is the path used by ai-api's outbound calls.** |
| Celery payload does not carry trace_id | **MISSING** | `v1/learning/workers.py:20-29, 49-100` — no `traceId` key in `state.dict()`; no `trace_id` in `generating_new_content` payload. Confirmed foundation audit §7. |
| LangGraph state has no trace_id field | **MISSING** | `v1/learning/content_pipeline.py:254-271` — `graph` has no `traceId` in the state schema (`GenerateContentMaterialPipeline` DTO has none) |
| Per-worker `x-trace-id` generated on Celery enqueue | **MISSING** | `v1/learning/router.py:22, 47` — no `trace_id` parameter is computed or passed |
| Multi-replica safe: trace_id source of truth | **MISSING** | None — no per-replica trace_id derivation |

---

## 7. CORS and Network

| Item | Status | Evidence |
|---|---|---|
| CORS allow-list to `ADMIN_URL` + `WEB_URL` only | PRESENT | `services/ai-api/main.py:14-23` |
| `allow_credentials=True` | PRESENT | `main.py:20` |
| `allow_methods=["*"]` (broad) | PARTIAL | `main.py:21` — only `GET`/`POST` are actually exposed; tighten to `["GET","POST"]` per foundation audit §12 |
| `allow_headers=["*"]` (broad) | PARTIAL | `main.py:22` — `Authorization` and `x-*` headers are required; tightening to the explicit set is a hardening win, not a CVE |
| Tutor routes require `Authorization` (parse only, no validation) | PRESENT | `v1/learning/router.py:14, 19, 42, 46` |
| Tutor routes do not validate bearer against api | **MISSING** | `v1/learning/router.py` — `token = authorization.replace("Bearer ", "")` with no `authenticate()` call. ai-api is a **trust-on-first-use** proxy: it forwards any string that starts with `Bearer ` to the api and to Celery. |
| `/v1/users-steps/generate-question` is a public GET with token in URL | **VIOLATION** of master prompt §91 | `v1/users_steps/router.py:21-90` — `GET /v1/users-steps/generate-question?token=...`; `GET` is CORS-preflight-friendly; token in URL lands in nginx access logs and browser history. |
| `/v1/agents/run` bearer parsed but never validated | PARTIAL | `v1/agents/router_endpoint.py:37-39` — only checks `startswith("Bearer ")`. |

---

## 8. Web Search and RAG Prompt Injection

| Item | Status | Evidence |
|---|---|---|
| `tool_web_search` filters each result with `looks_like_instruction` | PRESENT | `services/ai-api/utils/tools/web_search.py:37-40` |
| `tool_memory_upsert` filters with `looks_like_instruction` | PRESENT | `services/ai-api/utils/tools/memory.py:86-89` |
| `EmbeddingPipeline.upsert_document` filters with `looks_like_instruction` | **MISSING** | `services/ai-api/config/embedding_pipeline.py:200-230` — no filter; the contract says "memory" uses the filter, but the embedding pipeline does not |
| Tavily request signed with `TAVILY_API_KEY` in body | PRESENT (defect) | `web_search.py:15-17` — `api_key` in JSON body; not in `Authorization` header. Tavily's official API expects this, but the secret travels unredacted through any intermediate proxy that logs the body. |
| LLM call site `build_segmented_prompt` (proper segmentation) | PARTIAL | `v1/learning/content_pipeline.py:186-216` is the **only** site that uses `build_segmented_prompt`; it wraps rag/web via `segment_retrieved` (`:169-176`). Confirmed foundation audit §11. |
| LLM call site `get_propmpt_material` (manual prompt, partial segmentation) | **MISSING segmentation on rag/web** | `v1/learning/service.py:126-158` — only the user `query` is wrapped in `<user_input trust="untrusted">`; `rag` and `web` are interpolated raw. `rag` and `web` are the highest-trust-violation vector (Tavily + Qdrant). |
| LLM call site `node_personality_material_builder` | **MISSING segmentation** | `v1/users_steps/generate_user_steps_pipeline.py:168-204` — manual prompt, `scores_json` and `user_answers` interpolated raw. |
| LLM call site `node_generate` (learning path) | **MISSING segmentation** | `v1/users_steps/generate_user_steps_pipeline.py:258-332` — manual prompt with `state.context` (lessons, personality) and `state.memory` raw. |
| LLM call site `analyze_text` (quiz summary + quiz generation) | **MISSING segmentation** | `v1/users_steps/generate_quiz_pipeline.py:30-38, 60-141` — `<context>` block is not annotated as untrusted; `rag_context` raw. |
| LLM call site `parallel_fetch` analysis (prep context) | **MISSING segmentation** | `v1/learning/content_pipeline.py:66-94` — f-string prompt with topic/lesson/step/learning_style/userStep interpolated raw. |
| LLM call site `build_learning_introduction_llm` (SSE) | **MISSING segmentation** | `v1/users_steps/service.py:172-216` — manual f-string with `step_data` and `retrieval_info` raw; `pipeline.llm.stream(prompt)` |
| LLM call site `EmbeddingPipeline.translate` | **MISSING segmentation** | `config/embedding_pipeline.py:155-161` — `prompt = f"Translate to English:\n{text}"` with no `segment_user_input` wrapper. |
| `looks_like_instruction` regex coverage | WEAK | `config/prompt_segmentation.py:19-32` — 9 patterns, none cover role override via Markdown, indirect injection via JSON, emoji-prefixed instructions, or any non-English pattern. Master prompt §92 requires stronger defense. |
| All retrieved content is wrapped in `<retrieved_documents trust="untrusted">` before LLM | **MISSING** (1 of 8 sites) | only `v1/learning/content_pipeline.py:215` and `:169-176` do; the other 7 LLM call sites are manual f-strings. Master prompt §92 not satisfied. |

---

## 9. Resource Extraction SSRF

| Item | Status | Evidence |
|---|---|---|
| `extract_pdf` validates URL with `assert_url_allowed` | PRESENT | `services/ai-api/v1/resources/service.py:112-119` |
| `download_audio` validates URL with `assert_url_allowed` | **MISSING** | `services/ai-api/v1/resources/service.py:71-78` — `subprocess.run(["yt-dlp", ...])` with user-supplied `url` and no allow-list |
| `download_audio` is invoked only after `get_yt_transcript` returns None | PRESENT (mitigation) | `services/ai-api/v1/resources/service.py:104-108` — first tries `youtube_transcript_api` (YouTube-only by construction); falls back to `download_audio` if no transcript found |
| `download_audio` only reachable for `VIDEO` type | PRESENT (mitigation) | `v1/resources/workers.py:27-29` (`if type == "VIDEO": return get_yt_transcript(url)`) |
| `assert_url_allowed` is robust against DNS rebinding | **NOT AUDITED** | `config/url_allowlist.py` is referenced but the IP-resolution / DNS-rebinding policy is out of this audit scope. Foundation audit confirmed it exists. |
| `youtube-transcript-api` requires a video id; `get_video_id` only resolves YouTube domains | PRESENT | `services/ai-api/v1/resources/service.py:62-68` — `p.hostname in ("www.youtube.com", "youtube.com")` or `youtu.be`. Non-YouTube URL returns `None` and `get_yt_transcript` returns `None`. |
| `download_audio` reachable for a non-YouTube URL | **FLAWED** | `v1/resources/service.py:71-78` — if a teacher uploads a `VIDEO` resource with a non-YouTube URL (e.g. `https://attacker.example/audio.wav`), the `get_yt_transcript` path returns `None` (no video id) and then `download_audio(url)` is called, which spawns `yt-dlp` against the attacker URL. yt-dlp supports many extractors beyond YouTube, including local file paths. **Soft SSRF / RCE-via-yt-dlp risk.** |
| `subprocess.run` with `check=True` propagates non-zero exit to the celery retry | PRESENT | `v1/resources/service.py:74-77` — `check=True` raises `CalledProcessError` on non-zero exit; celery retries up to 3x (line 41) |

---

## 10. Container and Process Isolation

| Item | Status | Evidence |
|---|---|---|
| `Dockerfile` runtime stage `USER reducera` | PRESENT | `services/ai-api/Dockerfile:47-48, 57` — `groupadd -r reducera && useradd -r -g reducera -m`; `USER reducera` |
| Build stage runs as root but the runtime stage does not | PRESENT | `Dockerfile:40-57` — `runner` stage does not contain `USER root`; build is root by default in Docker, but the runtime drops to `reducera` |
| `HEALTHCHECK` directive in Dockerfile | PRESENT | `Dockerfile:61-62` — `curl -fsS http://localhost:3003/` every 30s |
| `EXPOSE 3003` documented | PRESENT | `Dockerfile:59` |
| Celery worker is a separate service, not a subprocess | PRESENT | `Dockerfile:64-66` — comment says "TIDAK spawn Celery sebagai subprocess lagi" (do not spawn Celery as a subprocess anymore) |
| ai-api process runs as PID 1 with `dumb-init` / `tini` | **NOT VERIFIED** | `Dockerfile` uses `CMD ["uvicorn", ...]` directly without an init wrapper; uvicorn does not handle `SIGTERM` reliably as PID 1. Foundation audit did not flag this either. |
| Container has `read_only` root filesystem | **MISSING** | no `read_only: true` in compose (not in this audit's file scope); the Dockerfile does not enforce read-only. |

---

## 11. Secrets, Logging, PII

| Item | Status | Evidence |
|---|---|---|
| `INTERNAL_AI_API_SECRET` read fresh from env per call | PRESENT | `services/ai-api/config/service_auth.py:31-33` (`os.getenv(SECRET_ENV, "")`) |
| `INTERNAL_AI_API_SECRET` not used to derive anything on the wire | PRESENT | signer uses it as the HMAC key; verifier uses it as the HMAC key; nothing else reads it. |
| `OPENAI_API_KEY`, `HF_TOKEN`, `TAVILY_API_KEY`, `QDRANT_API_KEY` in env | PRESENT | `config/envs.py:38-58` |
| api-side secret rotation window (old + new accepted) | **MISSING** | `services/api/src/common/authz/internal-service.guard.ts:60-64` — single `secret = this.config.get<string>(secretEnv)`. No `SERVICE_SECRET_ENV_ROTATION` map. Master prompt §22 lists this as a Phase 1 hardening. |
| ai-api supports old + new secret simultaneously | **MISSING** | `service_auth.py:31-35` — single `_secret()`; no rotation list |
| `print()` debug in production paths | PRESENT (defect) | `services/ai-api/v1/learning/content_pipeline.py:42` (`print(userStep)`); `services/ai-api/v1/learning/service.py:106` (`print(user_step)`); `config/celery.py:52-53` |
| Log lines include user-step JSON, not bearer | PARTIAL | `print(userStep)` and `print(user_step)` print the user-step object verbatim (includes `id`, `title`, `progress`, etc.) — PII-adjacent, not bearer. No log line in ai-api includes the raw `state.token` or the `Authorization` header. |
| Structured JSON logging | **MISSING** | `config/embedding_pipeline.py:27`, `config/memory_embedding.py:19` — `logger.setLevel(logging.INFO)` only; no JSON formatter; no log filter redacts `Authorization` or `Bearer ...` |
| `LOG_LEVEL` env var | **MISSING** | no `LOG_LEVEL` in `config/envs.py`; level is hardcoded in two places |
| Trace-id printed raw in logs (log-injection risk on api side) | **OUT OF SCOPE** but flagged | `trace-id.decorator.ts:7` accepts any 1-128 char string; ai-api does not log `internalCaller.traceId` but any future code that does will print attacker-controlled bytes |

---

## 12. Instruction-Injection Defense Coverage (master prompt §92)

The `looks_like_instruction` filter is a 9-regex list at `config/prompt_segmentation.py:19-32`. LLM call-site audit (12 invocations across 7 files):

| Call site | Uses `build_segmented_prompt` | Uses `segment_retrieved` | Uses `looks_like_instruction` on input | Verdict |
|---|---|---|---|---|
| `v1/learning/content_pipeline.py:77` (analysis) | NO | NO | NO | raw f-string |
| `v1/learning/content_pipeline.py:219` (final generation) | YES | YES (`segment_retrieved` on rag+web) | N/A | **compliant** |
| `v1/learning/workers.py:69` (`generating_new_content` → `get_propmpt_material`) | NO (built in `v1/learning/service.py:126-158`) | NO (rag and web raw) | partial: query wrapped in `<user_input trust="untrusted">` only | **non-compliant** |
| `v1/users_steps/service.py:206` (`build_learning_introduction_llm.stream`) | NO | NO | NO | raw f-string |
| `v1/users_steps/generate_user_steps_pipeline.py:212` (personality prompt) | NO | NO | NO | raw f-string |
| `v1/users_steps/generate_user_steps_pipeline.py:341` (learning path prompt) | NO | NO | NO | raw f-string |
| `v1/users_steps/generate_quiz_pipeline.py:35` (summary) | NO | NO | NO | raw f-string |
| `v1/users_steps/generate_quiz_pipeline.py:150` (quiz prompt) | NO (uses `<context>` block, not `<retrieved_documents trust="untrusted">`) | NO | NO | raw f-string |
| `config/embedding_pipeline.py:160` (`translate`) | NO | NO | NO | raw f-string |

| Item | Status | Evidence |
|---|---|---|
| LLM call sites that go through `build_segmented_prompt` | 1 of 8 (12.5%) | only `v1/learning/content_pipeline.py:186-216` |
| Call sites that wrap rag/web in `<retrieved_documents trust="untrusted">` | 1 of 8 | only `v1/learning/content_pipeline.py:169-176, 215` |
| Call sites that pass the bearer to the LLM | 0 | no LLM prompt includes `state.token`; **confirmed safe today** |
| Call sites that pass user-derived PII to the LLM | all 8 | user_step, lesson, topic, learning_style, quiz answers, personality answers — all in plain text. Acceptable per design (tutor), but raw PII is in prompt text. |
| `looks_like_instruction` failure rate on real-world Tavily snippets | **NOT MEASURED** | no eval suite |
| Memory and RAG writes filtered with `looks_like_instruction` | PARTIAL | `tool_memory_upsert` yes (`utils/tools/memory.py:87`); `EmbeddingPipeline.upsert_document` no (`config/embedding_pipeline.py:200-230`); `tool_web_search` results yes (`web_search.py:37-40`) |

---

## 13. Critical Defects (security layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | Bearer token forwarded into Celery payload, persists in cleartext in Redis broker | `services/ai-api/v1/learning/router.py:19, 22, 46-47` → `v1/learning/workers.py:20-29, 49-100`; broker: `services/ai-api/config/celery.py:11-15` |
| CRITICAL | Bearer token sent as `?token=...` query string on `/v1/users-steps/generate-question`; logged by nginx and FastAPI | `services/ai-api/v1/users_steps/router.py:21-90` |
| HIGH | Replay cache is in-process `Map`; second api replica accepts the same signed request | `services/api/src/common/authz/internal-service.guard.ts:42, 100-109` |
| HIGH | Timestamp monotonicity not enforced; future-dated signature within 60s accepted | `services/api/src/common/authz/internal-service.guard.ts:67` |
| HIGH | 7 of 8 LLM call sites do not use `build_segmented_prompt`; rag and web text injected raw | `v1/learning/service.py:126-158`, `v1/users_steps/service.py:172-216`, `v1/users_steps/generate_user_steps_pipeline.py:168-204, 258-332`, `v1/users_steps/generate_quiz_pipeline.py:30-38, 60-141`, `v1/learning/content_pipeline.py:66-94` |
| HIGH | `EmbeddingPipeline.upsert_document` does not run `looks_like_instruction` on the content it persists to Qdrant | `services/ai-api/config/embedding_pipeline.py:200-230` |
| HIGH | No api-side secret rotation window; old secret immediately invalid on rotation | `services/api/src/common/authz/internal-service.guard.ts:24-26, 60-64`; `services/ai-api/config/service_auth.py:31-35` |
| MEDIUM | `download_audio` is not gated by `assert_url_allowed`; a non-YouTube VIDEO URL reaches `yt-dlp` directly | `services/ai-api/v1/resources/service.py:71-78, 92-109` |
| MEDIUM | `EmbeddingPipeline.translate` is a raw f-string prompt (`f"Translate to English:\n{text}"`) with no segmentation | `services/ai-api/config/embedding_pipeline.py:155-161` |
| MEDIUM | `tool_web_search` puts `api_key` in the JSON body (vendor requirement) — secret travels through any intermediate proxy that logs the body | `services/ai-api/utils/tools/web_search.py:15-17` |
| MEDIUM | Tutor routes require `Authorization` but never validate it; ai-api is trust-on-first-use | `services/ai-api/v1/learning/router.py:14-60`, `v1/users_steps/router.py:92-131` |
| MEDIUM | Trace-id decorator accepts 1-128 char string with no control-byte filter — log injection on api side (out of ai-api direct control, but it is the verifier used by ai-api) | `services/api/src/common/authz/trace-id.decorator.ts:7` |
| LOW | `print(userStep)` and `print(user_step)` leak user-step JSON into logs | `v1/learning/content_pipeline.py:42`, `v1/learning/service.py:106` |
| LOW | `allow_methods=["*"]` and `allow_headers=["*"]` in CORS — should be tightened | `services/ai-api/main.py:21-22` |
| LOW | ai-api Dockerfile uses `CMD ["uvicorn", ...]` without an init wrapper (PID 1 signal handling) | `services/ai-api/Dockerfile:64-66` |

---

## 14. Evidence Trail Summary

| Source | File | What it confirmed |
|---|---|---|
| Signer | `services/ai-api/config/service_auth.py:22-89` | HMAC scheme, header set, no replay cache on ai-api side |
| Verifier | `services/api/src/common/authz/internal-service.guard.ts:46-98` | Clock skew 60s, replay 120s, idempotency-key required for mutations |
| Verifier crypto | `services/api/src/common/authz/internal-signature.ts:18-33` | `timingSafeEqual` on hex strings |
| Idempotency table | `services/api/prisma/schema.prisma:1075-1089`; `prisma/migrations/20260115090000_idempotency_key/migration.sql:1-20` | Composite PK `(key, userId)`; `expiresAt` index |
| Bearer leak | `services/ai-api/v1/learning/router.py:14-60`; `v1/learning/workers.py:20-100`; `v1/users_steps/workers.py:38`; `v1/users_steps/router.py:21-90` | Token in state dict, in Celery payload, in URL query string |
| Celery broker | `services/ai-api/config/celery.py:11-22`; `config/envs.py:59-61` | Broker = `CELERY_BROKER_URL`; result backend = `CELERY_RESULT_BACKEND`; both default to `REDIS_URL` (`redis://redis:6379/0`) |
| Prompt segmentation | `services/ai-api/config/prompt_segmentation.py:19-166`; `v1/learning/content_pipeline.py:186-216`; `v1/learning/service.py:126-158`; `v1/users_steps/generate_user_steps_pipeline.py:168-332`; `v1/users_steps/generate_quiz_pipeline.py:30-150`; `v1/users_steps/service.py:172-216`; `config/embedding_pipeline.py:155-161` | Only 1 of 8 LLM sites uses `build_segmented_prompt` |
| RAG & web | `services/ai-api/utils/tools/web_search.py:13-43`; `services/ai-api/utils/tools/memory.py:81-100`; `services/ai-api/config/embedding_pipeline.py:200-230` | `looks_like_instruction` on web and memory, **not** on embedding upsert |
| Trace-id | `services/ai-api/config/service_auth.py:49-60`; `services/api/src/common/authz/trace-id.decorator.ts:4-9` | ai-api auto-generates; api accepts 1-128 chars no control-byte filter |
| CORS | `services/ai-api/main.py:14-23` | allow-list OK; `*` on methods/headers |
| SSRF | `services/ai-api/v1/resources/service.py:71-119` | `extract_pdf` allow-listed; `download_audio` not |
| Container | `services/ai-api/Dockerfile:40-66` | `USER reducera` runtime; no init wrapper |

---

## 15. What Phase 1 Must Build Beyond P1-A

```text
1.  Strip Bearer from Celery payload. The route handler must:
    a. read `Authorization`, call `authenticate(authorization, ...)` against api /api/v1/auth/verify to mint a short-lived (≤ 5 min) service-issued capability bound to (userId, route, expiry);
    b. pass only `(userId, idempotency_key, trace_id, capability_token)` to Celery, never `state.token`;
    c. workers re-validate the capability against api before each cross-service call.
2.  Move replay cache from in-process `Map` to Redis (`reducera_internal_replay` key with `SET ... NX PX 120000`); INCR on hit. The api side owns the cache; ai-api signer is unchanged.
3.  Add per-service replay window and clock skew config (`SERVICE_REPLAY_MS`, `SERVICE_SKEW_MS`) keyed by `serviceId`. Default ai-api to 120000 / 60000.
4.  Enforce timestamp monotonicity: reject signatures with `timestamp > Date.now() + MAX_CLOCK_SKEW_MS` even though `Math.abs` is bounded. Tighten to a one-sided `timestamp < now - SKEW` only.
5.  Add a `TraceIdMiddleware` at the ai-api ingress that:
    a. reads `x-trace-id` (1-128 chars, control-byte-stripped);
    b. generates a uuid4 if absent;
    c. attaches to a `contextvars.ContextVar` for the request and to every Celery `apply_async(headers=...)` payload;
    d. injects into every LLM call's `metadata` so the LLM provider sees the trace id.
6.  Replace every LLM call site with `build_segmented_prompt` (or `build_quiz_prompt` for the quiz case). Specifically:
    a. `v1/learning/service.py:get_propmpt_material` — wrap `rag` and `web` via `segment_retrieved`;
    b. `v1/users_steps/service.py:build_learning_introduction_llm` — wrap `step_data` and `retrieval_info`;
    c. `v1/users_steps/generate_user_steps_pipeline.py:node_personality_material_builder` and `node_generate`;
    d. `v1/users_steps/generate_quiz_pipeline.py:analyze_text` summary and quiz;
    e. `v1/learning/content_pipeline.py:prepare_learning_context` analysis prompt;
    f. `config/embedding_pipeline.py:translate`.
7.  Add `looks_like_instruction` to `EmbeddingPipeline.upsert_document` before any Qdrant write. Or: enforce at the entry points (`tool_memory_upsert`, `upsert_document`) via a shared gate.
8.  Move `INTERNAL_AI_API_SECRET` to a rotation list: `SERVICE_SECRET_ENV = { "ai-api": ["INTERNAL_AI_API_SECRET", "INTERNAL_AI_API_SECRET_PREVIOUS"] }`. Guard accepts any matching secret; signer signs with the first.
9.  Gate `download_audio` with `assert_url_allowed` AND a YouTube-only hostname check. Refuse any non-YouTube URL with 422.
10. Remove the SSE `?token=` query string from `/v1/users-steps/generate-question`. Pass the bearer via the `Authorization` header (FastAPI SSE supports it) and via a one-time ticket minted by `authenticate()`.
11. Tighten CORS: `allow_methods=["GET","POST"]`, `allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Requested-With"]`.
12. Replace `print(userStep)` and `print(user_step)` with `logger.debug(...)`. Add a redaction filter that drops any field whose name is `token`, `Authorization`, `Bearer`, or any string field whose value matches `^Bearer\s.+`.
13. Add `LOG_LEVEL` env and a JSON formatter. Pipe to stdout (compose already collects).
14. Add `read_only: true` to the ai-api compose service and a tmpfs for `/tmp` so worker downloads (yt-dlp audio.wav) are isolated.
15. Add `dumb-init` (or `tini`) as the Dockerfile ENTRYPOINT so uvicorn handles SIGTERM as PID 1.
16. Apply `authenticate(Authorization, ...)` on every route in `v1/learning/router.py` and `v1/users_steps/router.py` (with the appropriate role for the route). The ai-api must verify the bearer, not the api alone.
17. Add a periodic drift test: every 60s, replay the most recent signed call against the api and assert 401 (replay cache hit). If 200, the cache has dropped the entry; raise an alert.
18. Audit `EmbeddingPipeline.translate` callers — currently unused in production paths, but `enable_translation=True` will reach Tavily's `api_key` in the body. Move the key to a header on a future Tavily-compatible provider.
```

(End of file — total 18 hardening items.)
