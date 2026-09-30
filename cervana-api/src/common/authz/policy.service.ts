import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface Actor {
  id: string;
  role: Role;
}

@Injectable()
export class PolicyService {
  isAdmin(actor?: Actor | null): boolean {
    return actor?.role === Role.ADMIN;
  }

  assertAdmin(actor?: Actor | null): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Administrator access required');
    }
  }

  assertSelfOrAdmin(actor: Actor | undefined | null, targetUserId: string): void {
    if (!actor?.id) {
      throw new ForbiddenException('Authentication required');
    }
    if (actor.id !== targetUserId && !this.isAdmin(actor)) {
      throw new ForbiddenException('Access to this resource is not permitted');
    }
  }

  assertOwnerOrAdmin(actor: Actor | undefined | null, ownerId: string | null | undefined): void {
    if (!actor?.id) {
      throw new ForbiddenException('Authentication required');
    }
    if (!ownerId || (actor.id !== ownerId && !this.isAdmin(actor))) {
      throw new ForbiddenException('Access to this resource is not permitted');
    }
  }

  resolveUserScope(actor: Actor, requestedUserId?: string): string | undefined {
    if (this.isAdmin(actor)) {
      return requestedUserId;
    }
    if (requestedUserId && requestedUserId !== actor.id) {
      throw new ForbiddenException('Access to this resource is not permitted');
    }
    return actor.id;
  }
}
