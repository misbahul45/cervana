import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '@prisma/client';
import { ACCESS_KEY } from '@/common/authz/access';
import { TENANT_HEADER, TenantContext } from './tenant-context';
import { TenantContextService } from './tenant-context.service';

export const TENANT_OPTIONS_KEY = 'tenancy:options';

export interface TenantScopedOptions {
  roles?: readonly TenantRole[];
  requireTenant?: boolean;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contexts: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<TenantScopedOptions>(TENANT_OPTIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {};
    const req = context.switchToHttp().getRequest();
    const raw = req.headers?.[TENANT_HEADER];
    const requested = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
    req.tenantContext = await this.contexts.resolve(req.user, requested, options);
    return true;
  }
}

export const TenantScoped = (options: TenantScopedOptions = {}) =>
  applyDecorators(
    SetMetadata(ACCESS_KEY, 'tenant'),
    SetMetadata(TENANT_OPTIONS_KEY, options),
    UseGuards(TenantGuard),
  );

export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => ctx.switchToHttp().getRequest().tenantContext,
);
