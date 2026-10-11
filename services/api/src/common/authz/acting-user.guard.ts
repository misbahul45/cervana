import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { assertOwnership, OwnershipMetadata } from '@/v1/common/guards/ownership.policy';
import { InternalCaller } from './internal-service.guard';

export const INTERNAL_OWNERSHIP_KEY = 'internal-ownership:resource';

@Injectable()
export class ActingUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const caller: InternalCaller | undefined = request.internalCaller;

    if (!caller) {
      throw new UnauthorizedException('Service credentials required');
    }

    if (!caller.actingUserId) {
      throw new BadRequestException({
        code: 'ACTING_USER_REQUIRED',
        message: 'x-acting-user-id header is required',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: caller.actingUserId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('Acting user is not allowed');
    }

    request.user = { id: user.id, role: user.role };

    const metadata = this.reflector.getAllAndOverride<OwnershipMetadata>(
      INTERNAL_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (metadata) {
      await assertOwnership(this.prisma, {
        actor: request.user,
        metadata,
        request,
        allowAdminBypass: false,
      });
    }

    return true;
  }
}
