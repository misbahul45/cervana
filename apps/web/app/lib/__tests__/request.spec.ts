import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { request } from '~/lib/api';
import { ApiError, unwrap, unwrapList } from '~/lib/api-error';

const runtimeConfig = { apiInternalUrl: 'http://api:3002', public: { API_URL: 'http://localhost' } };

const jsonResponse = (status: number, body: unknown, setCookies: string[] = []) => ({
  status,
  headers: { getSetCookie: () => setCookies },
  json: async () => body,
});

const stubNuxt = (cookie?: string) => {
  const setHeader = vi.fn();
  const event = { node: { res: { getHeader: vi.fn(), setHeader } } };
  vi.stubGlobal('useRuntimeConfig', () => runtimeConfig);
  vi.stubGlobal('useRequestHeaders', () => (cookie ? { cookie } : {}));
  vi.stubGlobal('useRequestEvent', () => event);
  return { setHeader };
};

const guardedFetch = (handler: (url: string, init: any, calls: number) => unknown) => {
  let calls = 0;
  const fn = vi.fn(async (url: string, init: any) => {
    calls += 1;
    if (calls > 12) throw new Error('runaway request loop');
    return handler(url, init, calls);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request on the server', () => {
  it('forwards the incoming cookie header so SSR calls stay authenticated', async () => {
    stubNuxt('access_token=abc; refresh_token=def');
    const fetchMock = guardedFetch(() => jsonResponse(200, { success: true, message: 'ok', data: { id: 1 } }));

    const res = await request<{ id: number }>('/orders', 'GET');

    expect(res.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('http://api:3002/api/v1/orders');
    expect(init.headers.cookie).toBe('access_token=abc; refresh_token=def');
  });

  it('prefers an explicit bearer token over the forwarded cookie', async () => {
    stubNuxt('access_token=cookie-token');
    const fetchMock = guardedFetch(() => jsonResponse(200, { success: true, message: 'ok' }));

    await request('/orders', 'GET', undefined, {}, true, { access_token: 'explicit' });

    const init = (fetchMock.mock.calls[0] as [string, any])[1];
    expect(init.headers.Authorization).toBe('Bearer explicit');
    expect(init.headers.cookie).toBeUndefined();
  });

  it('relays Set-Cookie from the API to the browser response', async () => {
    const { setHeader } = stubNuxt('refresh_token=old');
    guardedFetch(() =>
      jsonResponse(200, { success: true, message: 'ok' }, ['access_token=n; HttpOnly; Secure', 'refresh_token=m; HttpOnly; Secure']),
    );

    await request('/auth/check', 'GET');

    expect(setHeader).toHaveBeenLastCalledWith('set-cookie', [
      'access_token=n; HttpOnly; Secure',
      'refresh_token=m; HttpOnly; Secure',
    ]);
  });

  it('refreshes once on 401 and retries the original request with the new tokens', async () => {
    stubNuxt('refresh_token=old');
    const fetchMock = guardedFetch((url, _init, calls) => {
      if (url.endsWith('/auth/refresh-token')) {
        return jsonResponse(200, { success: true, message: 'ok', data: { access_token: 'new-a', refresh_token: 'new-r' } });
      }
      return calls === 1
        ? jsonResponse(401, { success: false, message: 'expired' })
        : jsonResponse(200, { success: true, message: 'ok', data: { id: 9 } });
    });

    const res = await request<{ id: number }>('/orders', 'GET');

    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryInit = (fetchMock.mock.calls[2] as [string, any])[1];
    expect(retryInit.headers.Authorization).toBe('Bearer new-a');
  });

  it('does not loop when the refresh endpoint itself answers 401', async () => {
    stubNuxt('refresh_token=expired');
    const fetchMock = guardedFetch(() => jsonResponse(401, { success: false, message: 'unauthorized' }));

    const res = await request('/orders', 'GET');

    expect(res.success).toBe(false);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('request in the browser', () => {
  const fetchError = (status: number, data: unknown) =>
    Object.assign(new Error('fetch failed'), {
      name: 'FetchError',
      response: { status },
      statusCode: status,
      data,
      options: { headers: { Authorization: 'Bearer SECRET-JWT' } },
    });

  beforeEach(() => {
    stubNuxt();
    vi.stubGlobal('window', {});
  });

  it('never serialises the raw error, which carries request headers', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(500, { message: 'boom' })));

    const res = await request('/orders', 'GET');

    expect(res.success).toBe(false);
    expect(JSON.stringify(res)).not.toContain('SECRET-JWT');
    expect(JSON.stringify(res)).not.toContain('Bearer');
  });

  it('keeps the status, code and request id so the UI can tell failures apart', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockRejectedValue(
        fetchError(409, { message: 'Already paid', code: 'CONFLICT', meta: { requestId: 'req-1' } }),
      ),
    );

    const res = await request('/orders', 'POST', {});

    expect(res.message).toBe('Already paid');
    expect(res.code).toBe('CONFLICT');
    expect(res.meta?.statusCode).toBe(409);
    expect(res.meta?.requestId).toBe('req-1');
  });

  it('reports a network failure as status 0 instead of a fabricated success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' })));

    const res = await request('/orders', 'GET');

    expect(res.success).toBe(false);
    expect(res.meta?.statusCode).toBe(0);
  });

  it('does not refresh-loop when /auth/refresh-token answers 401', async () => {
    let calls = 0;
    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls > 12) throw new Error('runaway request loop');
        throw fetchError(401, { message: 'unauthorized' });
      }),
    );

    const res = await request('/orders', 'GET');

    expect(res.success).toBe(false);
    expect(calls).toBeLessThanOrEqual(2);
  });
});

describe('unwrap helpers', () => {
  it('returns data for a successful envelope', () => {
    expect(unwrap({ success: true, message: 'ok', data: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapList({ success: true, message: 'ok', data: null })).toEqual([]);
  });

  it('throws an ApiError carrying the status for a failed envelope', () => {
    const failed = { success: false, message: 'nope', code: 'FORBIDDEN', meta: { statusCode: 403 } } as any;

    expect(() => unwrap(failed)).toThrow(ApiError);
    try {
      unwrapList(failed);
    } catch (error) {
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).kind).toBe('forbidden');
    }
  });
});
