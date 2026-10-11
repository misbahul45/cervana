import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { assertOwnership, OwnershipMetadata } from './ownership.policy';

export const OWNERSHIP_KEY = 'ownership:resource';

export type { OwnershipMetadata } from './ownership.policy';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<OwnershipMetadata>(
      OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) return true;

    const request = context.switchToHttp().getRequest();

    await assertOwnership(this.prisma, {
      actor: request.user,
      metadata,
      request,
      allowAdminBypass: true,
    });

    return true;
  }
}
