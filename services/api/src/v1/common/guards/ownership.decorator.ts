import { SetMetadata } from '@nestjs/common';
import { OWNERSHIP_KEY } from './ownership.guard';
import { OwnedResource } from './ownership.registry';

export const RequireOwnership = (
  resource: OwnedResource,
  options: { allowUnownedRead?: boolean; param?: string } = {},
) =>
  SetMetadata(OWNERSHIP_KEY, {
    resource,
    ownerField: 'userId',
    allowUnownedRead: options.allowUnownedRead,
    field: options.param,
  });

export const RequireParentOwnership = (
  resource: OwnedResource,
  field: string,
  source: 'body' | 'query' = 'body',
) =>
  SetMetadata(OWNERSHIP_KEY, {
    resource,
    ownerField: 'userId',
    source,
    field,
  });
