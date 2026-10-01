import { TenantProvisioningService } from '../tenant-provisioning.service';

describe('TenantProvisioningService', () => {
  const service = new TenantProvisioningService();

  const makeTx = (options: { ownerMembership?: boolean; takenSlugs?: string[] } = {}) => {
    const taken = new Set(options.takenSlugs ?? []);
    const created: any[] = [];
    const tx: any = {
      tenantMembership: {
        findFirst: jest.fn().mockResolvedValue(options.ownerMembership ? { tenantId: 'existing-tenant' } : null),
      },
      tenant: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => (taken.has(where.slug) ? { id: 'x' } : null)),
        create: jest.fn().mockImplementation(async (args) => {
          created.push(args);
          return { id: 'new-tenant' };
        }),
      },
    };
    return { tx, created };
  };

  it('creates a tenant with an OWNER membership and default settings', async () => {
    const { tx, created } = makeTx();
    const result = await service.provisionForOwner(tx, { id: 'u-1', displayName: 'Budi Santoso' });
    expect(result).toEqual({ tenantId: 'new-tenant', created: true });
    expect(created[0].data).toEqual({
      name: 'Budi Santoso',
      slug: 'budi-santoso',
      ownerId: 'u-1',
      memberships: { create: { userId: 'u-1', role: 'OWNER' } },
      settings: { create: {} },
    });
  });

  it('is repeat-safe: an owner who already has a tenant gets no second one', async () => {
    const { tx } = makeTx({ ownerMembership: true });
    const result = await service.provisionForOwner(tx, { id: 'u-1', displayName: 'Budi' });
    expect(result).toEqual({ tenantId: 'existing-tenant', created: false });
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });

  it('resolves a slug collision with a random suffix', async () => {
    const { tx, created } = makeTx({ takenSlugs: ['budi-santoso'] });
    await service.provisionForOwner(tx, { id: 'u-1', displayName: 'Budi Santoso' });
    expect(created[0].data.slug).toMatch(/^budi-santoso-[0-9a-f]{4}$/);
  });

  it('falls back to a generic slug for names with no usable characters', async () => {
    const { tx, created } = makeTx();
    await service.provisionForOwner(tx, { id: 'u-1', displayName: '###' });
    expect(created[0].data.slug).toBe('tenant');
  });
});
