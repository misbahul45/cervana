import { SetMetadata } from '@nestjs/common';
import { OWNERSHIP_KEY, OwnershipMetadata } from './ownership.guard';

export const RequireOwnership = (
  resource: OwnershipMetadata['resource'],
) =>
  SetMetadata(OWNERSHIP_KEY, { resource, ownerField: 'userId' });