import { IdempotencyKeyGuard } from '../idempotency-key.guard';
import { REQUIRE_IDEMPOTENCY_KEY } from '../require-idempotency-key.decorator';

describe('IdempotencyKeyGuard (I-01: header enforcement)', () => {
  function makeGuard(decoratorPresent: boolean) {
    return new IdempotencyKeyGuard({
      getAllAndOverride: () => decoratorPresent,
    } as any);
  }

  function ctxWithHeader(value: string | undefined, handler: any = {}, klass: any = {}) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'idempotency-key': value } }),
      }),
      getHandler: () => handler,
      getClass: () => klass,
    };
  }

  it('allows when decorator is not present', () => {
    expect(makeGuard(false).canActivate(ctxWithHeader(undefined) as any)).toBe(true);
  });

  it('rejects missing header with BadRequestException', () => {
    expect(() => makeGuard(true).canActivate(ctxWithHeader(undefined) as any)).toThrow();
  });

  it('rejects header below 8 chars', () => {
    expect(() => makeGuard(true).canActivate(ctxWithHeader('short') as any)).toThrow();
  });

  it('accepts a header >= 8 chars', () => {
    expect(makeGuard(true).canActivate(ctxWithHeader('abcdefgh') as any)).toBe(true);
  });

  it('exports the metadata key', () => {
    expect(REQUIRE_IDEMPOTENCY_KEY).toBe('require_idempotency_key');
  });
});