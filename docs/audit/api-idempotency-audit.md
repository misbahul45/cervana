> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Idempotency audit of the Application API against master-prompt §16. The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document focuses on which routes require `Idempotency-Key`, which actually enforce it, and the contract implementation.

# 1. Standard contract

Defined in `services/api/src/v1/common/idempotency/idempotency.service.ts`.

| Behaviour | Where |
|---|---|
| Hash body + params (sha256) and store by `(key, userId)` for 24 h | `:48-67` |
| Same key + same body → return stored response | `:62-66` |
| Same key + different body → throw `400 IDEMPOTENCY_CONFLICT` | `:57-60` |
| Expiry: 24 h, sweep on next call | `:11, 53-55` |
| `Idempotency-Key` not required by the service (the controller decides) | `:37-40` |

`IdempotencyKey` Prisma model exists with `@@unique([key, userId])` (from migration `20260115090000_idempotency_key`).

# 2. Required routes (master-prompt §16)

| Route family | Why | Currently enforced? |
|---|---|---|
| `POST /orders` | money mutation, retry-prone on the manual payment flow | **no** (F-06) |
| `POST /orders/:id/cancel` | money-adjacent | no |
| `POST /orders/:id/refund-requests` | money | no |
| `POST /admin/refunds` | money | no |
| `POST /admin/refunds/:id/approve` | money | no |
| `POST /admin/refunds/:id/reject` | money | no |
| `POST /admin/refunds/:id/process` | money | no |
| `POST /payouts` | money | no |
| `POST /payouts/:id/cancel` | money | no |
| `POST /admin/payouts/:id/{start-review,approve,mark-paid,reject}` | money | no |
| `POST /admin/payments/manual/submissions/:id/{start-review,approve,reject}` | money | no |
| `POST /v1/internal/credits/reservations` (planned per ADR-007) | AI credit spend | not yet wired |
| `POST /v1/internal/credits/reservations/:id/settle` (planned) | AI credit spend | not yet wired |
| `POST /v1/internal/credits/reservations/:id/release` (planned) | AI credit spend | not yet wired |
| `POST /me/consents` (planned) | legal | not implemented |
| `POST /me/deletion-request` (planned) | legal | not implemented |
| `POST /admin/backup/run` | ops | not enforced (F-06) |
| `POST /admin/backup/restore` | ops | not enforced |

Total: ~18 money or sensitive routes should require `Idempotency-Key`. None of them currently do.

# 3. Where the service is wired

The `IdempotencyService.execute(ctx, work)` method is in the codebase but **not injected** into any controller. A grep confirms:

```bash
grep -rn "IdempotencyService\|idempotency.execute" services/api/src/v1 --include="*.ts" | grep -v spec
# (no results)
```

The service is ready to use; no controller calls it.

# 4. How `Idempotency-Key` propagation would look

A NestJS interceptor pattern, applied at the controller level:

```ts
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}
  async intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.headers['idempotency-key']) {
      // Money route: require the key
      if (isMoneyRoute(req.route)) throw new BadRequestException('idempotency_key_required');
      return next.handle();
    }
    return this.idempotency.execute(ctx, async () => {
      const result = await next.handle().toPromise();
      return { statusCode: result?.statusCode ?? 200, body: result?.data ?? result };
    });
  }
}
```

A simpler pattern: each service that performs a money mutation calls `idempotency.execute(ctx, async () => prisma.$transaction(...))` directly. The service is generic; the controller does not change.

# 5. Findings

## I-01 — `Idempotency-Key` not enforced on money or sensitive routes

- **Severity**: HIGH
- **Source**: All money and sensitive routes (table §2)
- **Current Behavior**: None of these routes reject requests that omit `Idempotency-Key`, none of them deduplicate retries. The `IdempotencyService` exists but has no caller.
- **Expected Behavior**: A retry with the same key and same body returns the original response; a retry with a different body returns `400 IDEMPOTENCY_CONFLICT`; a request without a key on a money route returns `400 IDEMPOTENCY_KEY_REQUIRED`.
- **Business Impact**: Without idempotency, a network blip on the buyer's network can cause the same order to be created twice; the second creation either fails with `409 ALREADY_OWNED` (good but inconsistent) or with `200` (bad: the buyer believes they paid once but the system created two). Same for refund, payout, credit top-up, credit spend.
- **Security Impact**: Without idempotency, replaying a malicious request could double-charge or double-credit. The current absence is a denial-of-service amplifier and a fairness risk.
- **Data Impact**: All money/credit tables.
- **Root Cause**: The contract is defined in `common/idempotency/idempotency.service.ts`; no service calls it. The standard was set up as a capability without a wiring step.
- **Required Change**:
  1. Wire `IdempotencyService` into `OrdersService.create`, `RefundsService.request/approve/process/reject`, `PayoutsService.request/cancel/approve/markPaid/reject`, `ManualPaymentService.approve/reject`, `AiCreditsService.topUp`, `WalletService.credit/debit` (if such a method exists), `BackupService.runBackup`, `BackupService.markRestored`, `ConsentService.record`, `DeletionService.request`.
  2. Add a global requirement for `Idempotency-Key` on the money-route decorators (`@Roles(Role.ADMIN)` payment-review routes, payout routes, etc.). The `@Idempotency-Key` decorator (which does not yet exist) is one option; the interceptor pattern is another.
  3. Add a CI test that runs each money route twice with the same key + body and asserts exactly one business effect.
- **Test Required**: For every row in table §2, run the test twice with the same key + body and assert one effect; twice with the same key + different body and assert `400 IDEMPOTENCY_CONFLICT`; once without a key and assert `400 IDEMPOTENCY_KEY_REQUIRED`.
- **Status**: `OPEN`

# 6. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
