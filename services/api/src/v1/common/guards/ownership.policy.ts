import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { OWNER_RESOLVERS, OwnedResource, UNOWNED } from './ownership.registry';

export interface OwnershipMetadata {
  resource: OwnedResource;
  ownerField: string;
  source?: 'param' | 'body' | 'query';
  field?: string;
  allowUnownedRead?: boolean;
}

export interface OwnershipActor {
  id: string;
  role: string;
}

export interface OwnershipRequest {
  method: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface OwnershipDecision {
  actor: OwnershipActor | null | undefined;
  metadata: OwnershipMetadata;
  request: OwnershipRequest;
  allowAdminBypass: boolean;
}

const carrierOf = (metadata: OwnershipMetadata, request: OwnershipRequest) => {
  const source = metadata.source ?? 'param';
  if (source === 'body') return request.body;
  if (source === 'query') return request.query;
  return request.params;
};

export const assertOwnership = async (
  prisma: PrismaService,
  { actor, metadata, request, allowAdminBypass }: OwnershipDecision,
): Promise<void> => {
  if (!actor?.id) {
    throw new ForbiddenException('Authentication required');
  }

  if (allowAdminBypass && actor.role === 'ADMIN') return;

  const raw = carrierOf(metadata, request)?.[metadata.field ?? 'id'];
  const resourceId = typeof raw === 'string' ? raw : undefined;

  if (!resourceId) {
    throw new ForbiddenException('Resource id required');
  }

  const resolver = OWNER_RESOLVERS[metadata.resource];
  if (!resolver) {
    throw new ForbiddenException('Resource not found');
  }

  const owner = await resolver(prisma, resourceId);

  if (owner === null) {
    throw new ForbiddenException('Resource not found');
  }

  if (owner === UNOWNED) {
    if (metadata.allowUnownedRead && request.method === 'GET') return;
    throw new ForbiddenException('Not the resource owner');
  }

  if (owner !== actor.id) {
    throw new ForbiddenException('Not the resource owner');
  }
};
