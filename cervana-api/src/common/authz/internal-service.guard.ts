import {
  CanActivate,
  ExecutionContext,
  Injectable,
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

export const SERVICE_SECRET_ENV: Readonly<Record<string, string>> = {
  'ai-api': 'INTERNAL_AI_API_SECRET',
};

export const MAX_CLOCK_SKEW_MS = 60_000;
export const REPLAY_WINDOW_MS = 120_000;

export interface InternalCaller {
  serviceId: string;
  traceId: string | null;
  idempotencyKey: string | null;
  actingUserId: string | null;
}

const READ_METHODS = new Set(['GET', 'HEAD']);

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly seen = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
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

    this.rejectReplay(`${serviceId}:${provided}`);

    const caller: InternalCaller = {
      serviceId,
      traceId: header(TRACE_ID_HEADER) ?? null,
      idempotencyKey,
      actingUserId: header(ACTING_USER_HEADER) ?? null,
    };
    req.internalCaller = caller;
    return true;
  }

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

export const InternalOnly = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(ACCESS_KEY, 'internal'),
    UseGuards(InternalServiceGuard),
  );
