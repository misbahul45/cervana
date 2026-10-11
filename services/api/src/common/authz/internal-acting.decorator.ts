import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { OwnedResource } from '@/v1/common/guards/ownership.registry';
import { ActingUserGuard, INTERNAL_OWNERSHIP_KEY } from './acting-user.guard';
import { InternalOnly } from './internal-service.guard';

export const InternalActing = () => applyDecorators(InternalOnly(), UseGuards(ActingUserGuard));

export const InternalOwnership = (
  resource: OwnedResource,
  options: { field?: string; source?: 'param' | 'body' | 'query' } = {},
) =>
  SetMetadata(INTERNAL_OWNERSHIP_KEY, {
    resource,
    ownerField: 'userId',
    field: options.field,
    source: options.source,
  });
