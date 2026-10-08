import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCESS_KEY } from './access';
import { IS_PUBLIC_KEY } from '@/v1/auth/auth.decorator';
import {
  ACTING_USER_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  TRACE_ID_HEADER,
  computeSignature,
  signaturesMatch,
} from './internal-signature';
import { RedisService } from '@/common/config/redis/redis.service';

export const SERVICE_SECRET_ENV: Readonly<Record<string, string>> = {
  'ai-api': 'INTERNAL_AI_API_SECRET',
};

export const MAX_CLOCK_SKEW_MS = 60_000;
export const REPLAY_WINDOW_MS = 120_000;
export const REPLAY_KEY_PREFIX = 'internal:replay:';

export interface InternalCaller {
  serviceId: string;
  traceId: string | null;
  idempotencyKey: string | null;
  actingUserId: string | null;
}

const READ_METHODS = new Set(['GET', 'HEAD']);

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly log = new Logger(InternalServiceGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = (name: string): string | undefined => {
      const value = req.headers?.[name];
      return typeof value === 'string' && value.length > 0 ? value : undefined;
    };

    const serviceId = header(SERVICE_ID_HEADER);
    const timestamp = header(SERVICE_TIMESTAMP_HEADER);
    const provided = header(SERVICE_SIGNATURE_HEADER);
    if (!serviceId || !timestamp || !provided) {
      throw new UnauthorizedException('Service credentials required');
    }

    const secretEnv = SERVICE_SECRET_ENV[serviceId];
    const secret = secretEnv ? this.config.get<string>(secretEnv) : undefined;
    if (!secret) {
      throw new UnauthorizedException('Unknown service');
    }

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_CLOCK_SKEW_MS) {
      throw new UnauthorizedException('Stale service request');
    }

    const body: Buffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0);
    const expected = computeSignature({
      secret,
      timestamp,
      method: req.method,
      target: req.originalUrl,
      body,
    });
    if (!signaturesMatch(expected, provided)) {
      throw new UnauthorizedException('Invalid service signature');
    }

    const idempotencyKey = header(IDEMPOTENCY_KEY_HEADER) ?? null;
    if (!READ_METHODS.has(String(req.method).toUpperCase()) && !idempotencyKey) {
      throw new UnauthorizedException('Idempotency key required for mutations');
    }

    await this.rejectReplay(`${serviceId}:${provided}`);

    const caller: InternalCaller = {
      serviceId,
      traceId: header(TRACE_ID_HEADER) ?? null,
      idempotencyKey,
      actingUserId: header(ACTING_USER_HEADER) ?? null,
    };
    req.internalCaller = caller;
    return true;
  }

  private async rejectReplay(key: string): Promise<void> {
    const redisKey = REPLAY_KEY_PREFIX + key;
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
}

export const InternalOnly = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(ACCESS_KEY, 'internal'),
    UseGuards(InternalServiceGuard),
  );
