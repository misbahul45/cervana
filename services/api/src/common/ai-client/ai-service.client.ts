import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  ACTING_USER_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  TRACE_ID_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';
import { AiServiceError, isRetryableStatus } from './ai-service.error';

export const CALLER_SERVICE_ID = 'api';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface AiServiceRequest {
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  actingUserId: string;
  idempotencyKey: string;
  traceId?: string;
  timeoutMs?: number;
}

export const deriveIdempotencyKey = (parts: string[]): string => {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(':');
    hash.update(part);
  }
  return hash.digest('hex');
};

const parseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const reportedError = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).error;
  return value === undefined || value === null ? null : String(value);
};

@Injectable()
export class AiServiceClient {
  constructor(private readonly config: ConfigService) {}

  async post<T = unknown>(request: AiServiceRequest): Promise<T> {
    const baseUrl = this.config.get<string>('AI_URL');
    if (!baseUrl) throw new AiServiceError('AI_URL is not defined', null, false);
    const secret = this.config.get<string>('INTERNAL_API_SECRET');
    if (!secret) throw new AiServiceError('INTERNAL_API_SECRET is not defined', null, false);

    const url = new URL(`${baseUrl.replace(/\/+$/, '')}${request.path}`);
    for (const [name, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(name, value);
    }

    const body = request.body === undefined ? '' : JSON.stringify(request.body);
    const timestamp = String(Date.now());
    const signature = computeSignature({
      secret,
      timestamp,
      method: 'POST',
      target: `${url.pathname}${url.search}`,
      body: Buffer.from(body),
      actingUserId: request.actingUserId,
    });

    const headers: Record<string, string> = {
      [SERVICE_ID_HEADER]: CALLER_SERVICE_ID,
      [SERVICE_TIMESTAMP_HEADER]: timestamp,
      [SERVICE_SIGNATURE_HEADER]: signature,
      [ACTING_USER_HEADER]: request.actingUserId,
      [IDEMPOTENCY_KEY_HEADER]: request.idempotencyKey,
      'Idempotency-Key': request.idempotencyKey,
    };
    if (request.traceId) headers[TRACE_ID_HEADER] = request.traceId;
    if (body) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: body || undefined,
        signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiServiceError(`AI service unreachable: ${(error as Error).message}`, null, true);
    }

    const payload = parseJson(await response.text());

    if (!response.ok) {
      throw new AiServiceError(`AI service answered ${response.status}`, response.status, isRetryableStatus(response.status));
    }

    const reported = reportedError(payload);
    if (reported !== null) {
      throw new AiServiceError(`AI service reported an error: ${reported}`, response.status, true);
    }

    return payload as T;
  }
}
