import { ConfigService } from '@nestjs/config';
import { AiServiceClient, deriveIdempotencyKey } from '../ai-service.client';
import { AiServiceError } from '../ai-service.error';

const SECRET = 'api-to-ai-test-secret';
const NOW = 1_800_000_000_000;

const configWith = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const validConfig = () => configWith({ AI_URL: 'http://ai-api:3003/ai/v1', INTERNAL_API_SECRET: SECRET });

const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('AiServiceClient', () => {
  let fetchMock: jest.SpyInstance;

  const sentRequest = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url: String(url), init: init as RequestInit, headers: init.headers as Record<string, string> };
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(reply(200, { ok: true }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const request = (overrides = {}) => ({
    path: '/users-steps/generate',
    body: { userId: 'u-1', stepId: 's-1' },
    actingUserId: 'u-1',
    idempotencyKey: 'a-derived-key-0001',
    ...overrides,
  });

  it('signs the exact body and target and matches the vector produced by the ai-api implementation', async () => {
    await new AiServiceClient(validConfig()).post(request());

    const { url, init, headers } = sentRequest();
    expect(url).toBe('http://ai-api:3003/ai/v1/users-steps/generate');
    expect(init.body).toBe('{"userId":"u-1","stepId":"s-1"}');
    expect(headers['x-service-timestamp']).toBe(String(NOW));
    expect(headers['x-service-signature']).toBe('d9f4e48da6d30d6552a5ce093e4bea3e53809868ce927671f96ddd27aacbead9');
  });

  it('signs the query string as part of the target and matches the ai-api vector for a body-less call', async () => {
    await new AiServiceClient(validConfig()).post(
      request({ path: '/resources/extract', body: undefined, query: { type: 'PDF', resource_id: 'r-1' } }),
    );

    const { url, init, headers } = sentRequest();
    expect(url).toBe('http://ai-api:3003/ai/v1/resources/extract?type=PDF&resource_id=r-1');
    expect(init.body).toBeUndefined();
    expect(headers['x-service-signature']).toBe('fc700baf0135ea78bde20a7aae0f3514ea91ee09b91fb83ee047709cf261dacc');
  });

  it('identifies the service and the acting user and never sends a user credential', async () => {
    await new AiServiceClient(validConfig()).post(request({ traceId: 'trace-1' }));

    const { headers } = sentRequest();
    expect(headers['x-service-id']).toBe('api');
    expect(headers['x-acting-user-id']).toBe('u-1');
    expect(headers['x-trace-id']).toBe('trace-1');
    expect(headers['Idempotency-Key']).toBe('a-derived-key-0001');
    expect(headers['x-idempotency-key']).toBe('a-derived-key-0001');
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('authorization');
    expect(String(sentRequest().init.body)).not.toMatch(/token/i);
  });

  it('returns the parsed JSON of a successful answer', async () => {
    fetchMock.mockResolvedValue(reply(200, { task_id: 't-1', status: 'queued' }));

    await expect(new AiServiceClient(validConfig()).post(request())).resolves.toEqual({ task_id: 't-1', status: 'queued' });
  });

  it.each([400, 401, 403, 404, 409, 422])('treats %i as a failure that retrying cannot fix', async (status) => {
    fetchMock.mockResolvedValue(reply(status, { detail: 'no' }));

    const failure = await new AiServiceClient(validConfig()).post(request()).catch((error) => error);

    expect(failure).toBeInstanceOf(AiServiceError);
    expect(failure).toMatchObject({ status, retryable: false });
  });

  it.each([408, 429, 500, 502, 503])('treats %i as a failure worth retrying', async (status) => {
    fetchMock.mockResolvedValue(reply(status, { detail: 'later' }));

    const failure = await new AiServiceClient(validConfig()).post(request()).catch((error) => error);

    expect(failure).toMatchObject({ status, retryable: true });
  });

  it('treats an error body returned with status 200 as a retryable failure', async () => {
    fetchMock.mockResolvedValue(reply(200, { error: 'Generation failed' }));

    const failure = (await new AiServiceClient(validConfig()).post(request()).catch((error) => error)) as AiServiceError;

    expect(failure).toBeInstanceOf(AiServiceError);
    expect(failure.message).toContain('Generation failed');
    expect(failure.retryable).toBe(true);
  });

  it('treats a network failure and a timeout as retryable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const client = new AiServiceClient(validConfig());

    const network = await client.post(request()).catch((error) => error);
    const timeout = await client.post(request()).catch((error) => error);

    expect(network).toMatchObject({ status: null, retryable: true });
    expect(timeout).toMatchObject({ status: null, retryable: true });
  });

  it('passes an abort signal that honors the requested timeout', async () => {
    await new AiServiceClient(validConfig()).post(request({ timeoutMs: 1234 }));

    expect(sentRequest().init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['AI_URL', { INTERNAL_API_SECRET: SECRET }],
    ['INTERNAL_API_SECRET', { AI_URL: 'http://ai-api:3003/ai/v1' }],
  ])('fails without a retry when %s is not configured', async (_name, values) => {
    const failure = await new AiServiceClient(configWith(values)).post(request()).catch((error) => error);

    expect(failure).toMatchObject({ status: null, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('deriveIdempotencyKey', () => {
    it('is stable for the same parts and different for any other part', () => {
      const base = ['user-steps', '42', '/users-steps/generate', '{"stepId":"s-1"}'];

      expect(deriveIdempotencyKey(base)).toBe(deriveIdempotencyKey([...base]));
      expect(deriveIdempotencyKey(base)).toMatch(/^[0-9a-f]{64}$/);
      expect(deriveIdempotencyKey([...base.slice(0, 1), '43', ...base.slice(2)])).not.toBe(deriveIdempotencyKey(base));
      expect(deriveIdempotencyKey([...base.slice(0, 3), '{"stepId":"s-2"}'])).not.toBe(deriveIdempotencyKey(base));
    });

    it('does not let two different part lists collapse into one', () => {
      expect(deriveIdempotencyKey(['ab', 'c'])).not.toBe(deriveIdempotencyKey(['a', 'bc']));
    });
  });
});
