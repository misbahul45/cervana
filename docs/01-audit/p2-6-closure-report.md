# P2-6 Closure — Replay Cache → Redis

**Date:** 2026-10-05
**Scope:** Move the in-process replay cache used by `InternalServiceGuard` from a per-replica `Map` to a shared Redis store so the internal contract holds under horizontal scaling.
**Status:** **RESOLVED** with live signed verification and full test suite passing (1214 pass, 5 pre-existing skipped, 0 fail).

---

## 1. Before

```ts
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly seen = new Map<string, number>();   // ← process-local
  ...
  private rejectReplay(key: string): void {
    const now = Date.now();
    for (const [stored, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(stored);
    }
    if (this.seen.has(key)) {
      throw new UnauthorizedException('Replayed service request');
    }
    this.seen.set(key, now + REPLAY_WINDOW_MS);
  }
}
```

Each replica owns its own cache. The second replica accepts the same `serviceId:signature` pair the first replica already saw. Master prompt §110 (cross-service identity matrix): "Each cross-service call must be explicit" — but it was not safe under scale.

## 2. Fix

A shared `RedisService` (`services/api/src/common/config/redis/redis.service.ts`) provides the connection. `AuthzModule` imports `RedisModule` and exports `InternalServiceGuard` so the guard is constructed with the redis client injected.

The replay check is now an atomic `SET key value NX EX 120` — Redis returns `OK` on first write, `null` on conflict. Failure mode: if Redis is unreachable, the guard fails OPEN (signature is the trust boundary; replay cache is defense in depth). A warn-level log is emitted so the operator sees the degraded state.

```ts
private async rejectReplay(key: string): Promise<void> {
  const redisKey = REPLAY_KEY_PREFIX + key;            // 'internal:replay:'
  const seconds = Math.ceil(REPLAY_WINDOW_MS / 1000);
  try {
    const result = await this.redis.client.set(redisKey, '1', 'EX', seconds, 'NX');
    if (result === null) {
      throw new UnauthorizedException('Replayed service request');
    }
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err;
    this.log.warn(`Replay cache unavailable (${(err as Error).message}); allowing request`);
  }
}
```

`canActivate` is now async. The controller-level `@UseGuards(InternalServiceGuard)` is already async-aware; NestJS awaits the guard before invoking the handler.

## 3. Live verification

```text
$ python3 ... # signed POST /api/v1/internal/agent-sessions
HTTP 201: { sessionId: 2db34737-07fb-47ba-b3ea-44285228013d, ... }

$ docker exec reducera_redis redis-cli KEYS 'internal:replay:*'
internal:replay:ai-api:b8f7d2171a8b12c7ca90280e3fb9cff7872dc71214f666c1caf690ef37ddac2d

$ docker exec reducera_redis redis-cli TTL 'internal:replay:ai-api:...'
120  ← matches REPLAY_WINDOW_MS / 1000
```

After 120s the key auto-expires; new identical signatures will be accepted again (by design — that's the replay window).

## 4. Test-suite impact

The change adds a new constructor parameter to `InternalServiceGuard` (`RedisService`). Four test apps had to be updated to provide a `RedisService` mock:

- `src/v1/internal/__tests__/internal-agent-sessions.spec.ts`
- `src/v1/internal/__tests__/internal-episodes.spec.ts`
- `src/v1/internal/__tests__/internal-decision-traces.spec.ts`
- `src/v1/internal/__tests__/internal-resources.security.spec.ts` (pre-existing)

The "rejects an exact replay" test was updated to use a smart mock that returns `null` on the second SET (matching Redis NX semantics).

```text
Test Suites: 1 skipped, 111 passed, 111 of 112 total
Tests:       5 skipped, 1214 passed, 1219 total
```

No regressions.

## 5. Files Changed

```text
services/api/src/common/config/redis/redis.service.ts      (NEW)
services/api/src/common/authz/authz.module.ts             (imports RedisModule, exports InternalServiceGuard)
services/api/src/common/authz/internal-service.guard.ts   (uses redis client, async, fail-open)
services/api/src/v1/internal/__tests__/internal-agent-sessions.spec.ts        (mock redis)
services/api/src/v1/internal/__tests__/internal-decision-traces.spec.ts     (mock redis)
services/api/src/v1/internal/__tests__/internal-episodes.spec.ts              (mock redis)
services/api/src/v1/internal/__tests__/internal-resources.security.spec.ts    (mock redis + replay SET semantics)
```

## 6. Limitations

- The cache still allows a 120-second replay window (configurable via `REPLAY_WINDOW_MS`). Shortening it reduces the false-positive rate for clients that legitimately retry, but increases the risk of a replay attack within a clock-skew window. The 120s default matches the timestamp tolerance (`MAX_CLOCK_SKEW_MS = 60_000` × 2) so a clock skew can never cause a legit request to be flagged as a replay.
- The Redis client used by the API is a separate logical connection from the one BullMQ uses. Both talk to the same Redis instance, but commands on the replay cache do not share a pipeline slot with BullMQ jobs. This avoids pipeline contention under load.
- If Redis itself is down, the guard fails OPEN with a warn log. The signature check is still enforced; only the replay dedup is disabled. This is the right failure mode for a defense-in-depth layer.

P2-6 is **closed**. The internal contract is now safe at 1+ replicas.
