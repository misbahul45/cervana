import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { OWNER_RESOLVERS, OwnedResource, UNOWNED } from './ownership.registry';

export const OWNERSHIP_KEY = 'ownership:resource';

export interface OwnershipMetadata {
  resource: OwnedResource;
  ownerField: string;
  source?: 'param' | 'body' | 'query';
  field?: string;
  allowUnownedRead?: boolean;
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

    if (user.role === 'ADMIN') return true;

    const source = metadata.source ?? 'param';
    const field = metadata.field ?? 'id';
    const carrier = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const raw = carrier?.[field];
    const resourceId = typeof raw === 'string' ? raw : undefined;

    if (!resourceId) {
      throw new ForbiddenException('Resource id required');
    }

    const resolver = OWNER_RESOLVERS[metadata.resource];
    if (!resolver) {
      throw new ForbiddenException('Resource not found');
    }

    const owner = await resolver(this.prisma, resourceId);

    if (owner === null) {
      throw new ForbiddenException('Resource not found');
    }

    if (user.role === 'ADMIN') return true;

    if (owner === UNOWNED) {
      if (metadata.allowUnownedRead && req.method === 'GET') return true;
      throw new ForbiddenException('Not the resource owner');
    }

    if (owner !== user.id) {
      throw new ForbiddenException('Not the resource owner');
    }

    return true;
  }
}
