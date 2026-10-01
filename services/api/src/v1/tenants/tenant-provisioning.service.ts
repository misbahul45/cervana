import { Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, TenantRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { slugify } from '@/common/lib/utils';

@Injectable()
export class TenantProvisioningService {
  async provisionForOwner(
    tx: Prisma.TransactionClient,
    owner: { id: string; displayName: string },
  ) {
    const existing = await tx.tenantMembership.findFirst({
      where: { userId: owner.id, status: MembershipStatus.ACTIVE, role: TenantRole.OWNER },
      select: { tenantId: true },
    });
    if (existing) {
      return { tenantId: existing.tenantId, created: false };
    }

    const slug = await this.uniqueSlug(tx, owner.displayName);
    const tenant = await tx.tenant.create({
      data: {
        name: owner.displayName,
        slug,
        ownerId: owner.id,
        memberships: { create: { userId: owner.id, role: TenantRole.OWNER } },
        settings: { create: {} },
      },
      select: { id: true },
    });
    return { tenantId: tenant.id, created: true };
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base = slugify(name).slice(0, 48) || 'tenant';
    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken = await tx.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }
}
