import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export const OWNERSHIP_KEY = 'ownership:resource';

export interface OwnershipMetadata {
  resource: 'chat' | 'content' | 'user-step' | 'lesson-progress' | 'message';
  ownerField: string;
}

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

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      throw new ForbiddenException('Resource id required');
    }

    const ownerId = await this.fetchOwnerId(
      metadata.resource,
      resourceId,
    );

    if (!ownerId) {
      throw new ForbiddenException('Resource not found');
    }

    if (ownerId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Not the resource owner');
    }

    return true;
  }

  private async fetchOwnerId(
    resource: OwnershipMetadata['resource'],
    id: string,
  ): Promise<string | null> {
    switch (resource) {
      case 'chat':
        return this.fetchChatOwner(id);
      case 'content':
        return this.fetchContentOwner(id);
      case 'user-step':
        return this.fetchUserStepOwner(id);
      case 'message':
        return this.fetchMessageOwner(id);
      default:
        return null;
    }
  }

  private async fetchChatOwner(id: string): Promise<string | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      select: { userStep: { select: { userId: true } } },
    });
    return chat?.userStep?.userId ?? null;
  }

  private async fetchContentOwner(id: string): Promise<string | null> {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: { message: { select: { chat: { select: { userStep: { select: { userId: true } } } } } } },
    });
    return content?.message?.chat?.userStep?.userId ?? null;
  }

  private async fetchUserStepOwner(id: string): Promise<string | null> {
    const step = await this.prisma.userStep.findUnique({
      where: { id },
      select: { userId: true },
    });
    return step?.userId ?? null;
  }

  private async fetchMessageOwner(id: string): Promise<string | null> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id },
      select: { chat: { select: { userStep: { select: { userId: true } } } } },
    });
    return message?.chat?.userStep?.userId ?? null;
  }
}