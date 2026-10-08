# P3-1 Closure — Timeout Layering

**Date:** 2026-10-05
**Scope:** Align the per-edge nginx timeouts with the AI service's LLM timeout so the layer chain is monotonic (no contradictory bounds).
**Status:** **RESOLVED** with live re-verification.

---

## 1. Before

| Layer | Value | File |
|---|---|---|
| AI service LLM | 60s | `services/ai-api/config/providers.py:18` (`LLM_TIMEOUT_SECONDS`) |
| nginx `/ai/` read+send | 600s (10× the LLM) | `infra/nginx/nginx.conf` |
| nginx `/api/` read+send | 300s | `infra/nginx/nginx.conf` |
| nginx `/` (web SSR) read+send | 60s | `infra/nginx/nginx.conf` |

Master prompt §28: "There must not be contradictory timeout layers." The 10× ratio on `/ai/` is a smell — the AI service returns a 504 within 60s of the LLM call timing out, and nginx then waits the remaining 540s for the connection to be closed. That delay is not useful, but it also isn't harmful; it's just wasteful. The real risk is: if the AI's response is slow because the LLM is genuinely slow (no timeout fired), nginx keeps the connection open. That allows one slow request to tie up an upstream worker for 10 minutes.

## 2. Fix

`/ai/` read+send reduced from 600s to 180s. The new layering:

| Layer | Value | Rationale |
|---|---|---|
| AI service LLM | 60s | The actual timeout authority for LLM calls |
| nginx `/ai/` read+send | 180s | 3× the LLM ceiling; leaves room for RAG retrieval, post-processing, retry, and embedding (HF BAAI/bge-m3) without making the user wait forever |
| nginx `/api/` read+send | 300s | Unchanged. Some API operations (file extraction, embedding, content generation) can legitimately take several minutes |
| nginx `/` (web SSR) read+send | 60s | Unchanged. SSR has its own client-side guard; 60s is generous for first-paint |

The 60s → 180s ratio gives the AI service enough headroom for one LLM retry (60s) plus post-processing (≤60s) plus embedding (≤30s in the typical case). It is no longer "10× the LLM ceiling with no clear beneficiary".

## 3. Live verification

```text
$ docker compose exec -T nginx nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

$ docker compose restart nginx
reducera_nginx Restarting
reducera_nginx Started

$ curl /nginx-health /api/v1/docs /ai/ /
HTTP 200  HTTP 200  HTTP 200  HTTP 200
```

## 4. Files Changed

```text
infra/nginx/nginx.conf  (location /ai/ read+send: 600s → 180s)
```

One line, two values. No other change.

## 5. Limitations and future work

- The 180s upper bound is a heuristic. If the AI service ever adds a long-running operation (e.g., a 2-minute embedding job), this needs to be revisited. The 3× ratio is the most defensible simple rule: nginx waits at most 3 LLM ceilings before giving up.
- Per-route (not per-edge) timeout tuning would be even better. `/ai/v1/tutor/chat` and `/ai/v1/resources/embedding/{id}` may have very different time budgets. That level of detail is a future refactor; for now, the single edge-level timeout is sufficient and the change is a strict improvement (less wasted time on a hung upstream).
- This does not change the `client_max_body_size 50M;` at the http level; that is a separate constraint and remains at 50 MB.

P3-1 is **closed**. The only remaining item on the original `critical-findings.md` list was P3-1; the system is now free of P0, P1, P2, and P3 findings.
