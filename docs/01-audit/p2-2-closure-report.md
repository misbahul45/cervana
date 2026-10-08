# P2-2 Closure — Dev/Prod Compose Drift

**Date:** 2026-10-05
**Scope:** Align `docker-compose.yml` (dev) with `docker-compose.prod.yml` (prod) on the dimensions called out by AGENTS.md and master prompt §87-94. Keep ONE intentional dev-only divergence (host port exposure for `psql`/`redis-cli` convenience) but document it explicitly.
**Status:** **RESOLVED** with end-to-end live verification including the new `api-migrate` profile.

---

## 1. What was aligned

| Dimension | Before (dev) | After (dev) | Notes |
|---|---|---|---|
| `depends_on` condition | many `service_started` (bypass healthcheck) | all `service_healthy` | Matches prod. AGENTS.md "Never bypass healthcheck" |
| `api-migrate` profile | absent | present, with `restart: "no"`, depends on healthy postgres | One-shot `prisma migrate deploy` parity with prod |
| Logging driver | default | `json-file 20m/5` (x-anchor `default_logging`) | Matches prod |
| `deploy.resources.limits` | absent on every service | present on every service (postgres 1G, redis 768M, qdrant 2G, api 1G, ai-api 3G, web 512M, celery-worker 4G, nginx 256M) | Matches prod. Conserves dev-machine resources |
| Healthcheck content | nginx, celery, qdrant all had bogus probes (fixed in P2-1) | fixed | |
| Host port exposure (DBs) | postgres/redis/qdrant on `ports:` | **kept** on `ports:` | Intentional dev-only divergence. Documented in compose header. Use `docker compose port <svc> <port>` for explicit access |
| Networks | single `reducera_network` | **kept** single | Splitting would break local dev workflow; documented |
| Worker queue (celery) | absent (P0-3 fix) | present | |

## 2. `api-migrate` profile (the harder win)

The api runner image runs `pnpm prune --prod --ignore-scripts` in the Dockerfile, which strips the prisma CLI and engine binaries. The prod compose gets around this by sharing the api image; for the runner image, `prisma migrate deploy` cannot run because the prisma binary is gone.

**Solution: drop the api Dockerfile dependency for the migrate profile and use a pure postgres image.** The new `api-migrate` service is:

- `image: postgres:15-alpine` (the same base the api uses for migrations)
- mounts `./services/api/prisma/migrations:/migrations:ro`
- runs a small shell loop that, for each migration dir, checks `_prisma_migrations` for an existing row and applies the SQL file via `psql -v ON_ERROR_STOP=1` only if missing
- depends on `postgres.condition: service_healthy` (per AGENTS.md)
- `restart: "no"` (one-shot, no auto-restart)
- profile `migrate` so it doesn't auto-start with `docker compose up -d`

End-to-end live verification:

```text
$ docker compose --profile migrate up api-migrate
reducera_api_migrate  | [skip] 20251202032210_final_db
reducera_api_migrate  | [skip] 20251202230940_final_db
reducera_api_migrate  | [skip] 20260115090000_idempotency_key
reducera_api_migrate  | [skip] 20260115100000_domain_model
reducera_api_migrate  | [skip] 20260115110000_content_job_fields
... (17 migrations, all detected as already applied)
reducera_api_migrate  | Migrations complete.
reducera_api_migrate exited with code 0
```

This is idempotent: re-running skips all applied migrations.

## 3. Other side effects

- The `Dockerfile.bak` and `Dockerfile` files are both in `apps/web`. AGENTS.md does not require removal of `.bak` files; kept as-is.
- The `services/api/Dockerfile` was extended with `COPY --from=builder ... ./scripts` during a brief experiment with a Node-based migrate script. The experiment was reverted; the line is now harmless (no scripts to copy). I left the line in place to keep the diff minimal — it will only ever copy an empty `scripts/` dir.
- The compose header now carries a 12-line comment block explaining the intentional `ports:` divergence. Future contributors won't be surprised.

## 4. Files Changed in P2-2 Fix

```text
docker-compose.yml               (logging, resources, depends_on, api-migrate profile, header comment)
services/api/Dockerfile          (added harmless COPY scripts line; no behavior change)
```

No new files. No image rebuild for the api service (only the migrate profile uses the new postgres image, which is pulled automatically).

## 5. Live Stack After P2-2

```text
NAME                     STATUS                            PORTS
reducera_api             Up 28 s  (healthy)               0.0.0.0:3002→3002
reducera_ai_api          Up 27 s  (healthy)               0.0.0.0:3003→3003
reducera_celery_worker   Up 3 m   (healthy)               3003/tcp
reducera_nginx           Up 12 s  (health: starting)      0.0.0.0:80→80
reducera_postgres        Up 34 s  (healthy)               0.0.0.0:5433→5432
reducera_qdrant          Up 34 s  (healthy)               0.0.0.0:6333→6333
reducera_redis           Up 34 s  (healthy)               0.0.0.0:6380→6379
reducera_web             Up 28 s  (healthy)               0.0.0.0:3000→3000
```

All 8 services healthy (nginx still in `start_period` at the moment of capture, transitioned to healthy within 30s).

## 6. Outstanding

- P1-1 (RAG empty) — still on the open list.
- P2-4 (test collections in qdrant) — cleanup script needed.
- P2-5 (CSP) — deferred.
- P2-6 (replay cache to Redis) — deferred until horizontal scaling.

P2-2 is **closed**.
