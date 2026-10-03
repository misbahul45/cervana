# Redis Flush Recovery Runbook

## Preconditions

- `redis-cli` available against the production Redis container (`reducera_redis`).
- A backup of the cache contents (if available) in JSON form, e.g. `/backups/redis-snapshot-<date>.json`.

## Steps

1. Inspect the current state:
   ```
   docker exec reducera_redis redis-cli INFO keyspace
   docker exec reducera_redis redis-cli DBSIZE
   ```

2. Identify the cache-miss hot paths (these will spike after a flush):
   - `/v1/personalization/mastery/me`
   - `/v1/personalization/policy/next`
   - `/v1/commerce/credit-packages`
   - `/v1/sandbox/scenarios`

3. The application self-heals on miss — the cache layer falls back to the database. Verify by:
   ```
   curl -fsS http://api:3002/health
   docker logs --tail 200 reducera_api | grep 'cache'
   ```

5. If a JSON snapshot is available:
   ```
   cat /backups/redis-snapshot.json | docker exec -i reducera_redis redis-cli --pipe
   ```

## Expected output

- `INFO keyspace` shows new keys being created by traffic.
- `pnpm jest src/v1/common` smoke tests pass.
- The 5xx rate stays below the 1% alert threshold for 5+ minutes (per `infra/prometheus/prometheus.yml` rule `High5xxRate`).

## What to verify before declaring recovery complete

- `[OK] DBSIZE > 0 and growing with traffic`
- `[OK] /healthz returns 200`
- `[OK] 5xx rate < 1%`