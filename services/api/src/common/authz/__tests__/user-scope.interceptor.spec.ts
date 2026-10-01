import { CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { PolicyService } from '../policy.service';
import { UserScopeInterceptor } from '../access';

describe('UserScopeInterceptor', () => {
  const interceptor = new UserScopeInterceptor(new PolicyService());
  const next: CallHandler = { handle: () => of('ok') };

  const run = (user: unknown, req: Record<string, unknown>) => {
    const request: any = { user, method: 'GET', query: {}, body: undefined, ...req };
    const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    interceptor.intercept(ctx, next);
    return request;
  };

  it('forces the caller id into the query for non-admins', () => {
    const req = run({ id: 'u-1', role: 'STUDENT' }, { query: {} });
    expect(req.query.userId).toBe('u-1');
  });

  it('accepts a matching userId and rejects a different one', () => {
    expect(run({ id: 'u-1', role: 'STUDENT' }, { query: { userId: 'u-1' } }).query.userId).toBe('u-1');
    expect(() => run({ id: 'u-1', role: 'STUDENT' }, { query: { userId: 'u-2' } })).toThrow(ForbiddenException);
  });

  it('rejects array or object-shaped userId filters', () => {
    expect(() => run({ id: 'u-1', role: 'STUDENT' }, { query: { userId: ['u-1', 'u-2'] } })).toThrow(ForbiddenException);
    expect(() => run({ id: 'u-1', role: 'STUDENT' }, { query: { userId: { not: 'u-1' } } })).toThrow(ForbiddenException);
  });

  it('fills userId on POST bodies and rejects a foreign one', () => {
    const created = run({ id: 'u-1', role: 'STUDENT' }, { method: 'POST', body: { title: 'x' } });
    expect(created.body.userId).toBe('u-1');
    expect(() => run({ id: 'u-1', role: 'STUDENT' }, { method: 'POST', body: { userId: 'u-2' } })).toThrow(ForbiddenException);
    expect(() => run({ id: 'u-1', role: 'STUDENT' }, { method: 'PATCH', body: { userId: 'u-2' } })).toThrow(ForbiddenException);
  });

  it('does not touch admin requests', () => {
    const req = run({ id: 'a-1', role: 'ADMIN' }, { query: { userId: 'u-2' } });
    expect(req.query.userId).toBe('u-2');
  });

  it('rejects when there is no authenticated user', () => {
    expect(() => run(undefined, {})).toThrow(ForbiddenException);
  });
});
