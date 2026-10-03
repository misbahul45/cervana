import { applyDecorators, CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';

export const RATE_LIMIT_META = 'rate_limit_meta';

export interface RateLimitMeta {
  scope: string;
  limitPerMinute: number;
}

export const RateLimit = (meta: RateLimitMeta) =>
  applyDecorators(SetMetadata(RATE_LIMIT_META, meta), UseGuards(RateLimitGuard));

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RateLimitMeta | undefined>(RATE_LIMIT_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    const userId = req?.user?.id as string | undefined;
    if (!userId) return true;

    try {
      await this.service.consume({ userId, scope: meta.scope, limitPerMinute: meta.limitPerMinute });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException({ message: 'rate_limit_exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}