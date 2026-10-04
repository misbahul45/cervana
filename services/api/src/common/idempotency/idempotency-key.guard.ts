import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_IDEMPOTENCY_KEY } from './require-idempotency-key.decorator';

const MIN_KEY_LENGTH = 8;

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const key = req.headers?.['idempotency-key'];
    if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: `Idempotency-Key header required (>= ${MIN_KEY_LENGTH} chars)`,
      });
    }
    return true;
  }
}