import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/config/redis/redis.service';
import {
  ACTING_USER_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';

export const INTERNAL_TEST_SECRET = 'unit-test-service-secret';

export interface SignedRequestOptions {
  method: 'GET' | 'POST' | 'PATCH';
  target: string;
  body?: string;
  actingUser?: string;
  idempotencyKey?: string;
}

export const signInternalRequest = (options: SignedRequestOptions): Record<string, string> => {
  const timestamp = String(Date.now());
  const headers: Record<string, string> = {
    [SERVICE_ID_HEADER]: 'ai-api',
    [SERVICE_TIMESTAMP_HEADER]: timestamp,
    [SERVICE_SIGNATURE_HEADER]: computeSignature({
      secret: INTERNAL_TEST_SECRET,
      timestamp,
      method: options.method,
      target: options.target,
      body: Buffer.from(options.body ?? ''),
      actingUserId: options.actingUser,
    }),
  };
  if (options.method !== 'GET') {
    const key = options.idempotencyKey ?? `key-${Math.random().toString(36).slice(2)}`;
    headers[IDEMPOTENCY_KEY_HEADER] = key;
    headers['idempotency-key'] = key;
  }
  if (options.actingUser) headers[ACTING_USER_HEADER] = options.actingUser;
  return headers;
};

export const internalAuthProviders = () => {
  const seen = new Set<string>();
  const replayRedis = {
    set: jest.fn(async (key: string) => {
      if (seen.has(key)) return null;
      seen.add(key);
      return 'OK';
    }),
  };
  return [
    {
      provide: ConfigService,
      useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? INTERNAL_TEST_SECRET : undefined) },
    },
    { provide: RedisService, useValue: { client: replayRedis } },
  ];
};
