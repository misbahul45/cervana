import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PolicyService } from './policy.service';

export const ACCESS_KEY = 'authz:access';

export type AccessDecision = 'authenticated' | 'user-scoped';

export const AuthenticatedOnly = () => SetMetadata(ACCESS_KEY, 'authenticated' as AccessDecision);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class UserScopeInterceptor implements NestInterceptor {
  constructor(private readonly policy: PolicyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const actor = req.user;

    if (!actor?.id) {
      throw new ForbiddenException('Authentication required');
    }

    if (this.policy.isAdmin(actor)) {
      return next.handle();
    }

    const query = isPlainObject(req.query) ? req.query : {};
    const requested = typeof query.userId === 'string' ? query.userId : undefined;
    if (query.userId !== undefined && requested === undefined) {
      throw new ForbiddenException('Access to this resource is not permitted');
    }
    const scoped = this.policy.resolveUserScope(actor, requested);
    Object.defineProperty(req, 'query', {
      value: { ...query, userId: scoped },
      writable: true,
      configurable: true,
      enumerable: true,
    });

    if (isPlainObject(req.body)) {
      const supplied = req.body.userId;
      if (supplied !== undefined && supplied !== actor.id) {
        throw new ForbiddenException('Access to this resource is not permitted');
      }
      if (req.method === 'POST') {
        req.body.userId = actor.id;
      }
    }

    return next.handle();
  }
}

export const ScopeToUser = () =>
  applyDecorators(
    SetMetadata(ACCESS_KEY, 'user-scoped' as AccessDecision),
    UseInterceptors(UserScopeInterceptor),
  );
