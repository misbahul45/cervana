import { ForbiddenException } from '@nestjs/common';
import { assertOwnership, OwnershipDecision } from '../ownership.policy';

describe('assertOwnership', () => {
  let prisma: {
    chat: { findUnique: jest.Mock };
    quiz: { findUnique: jest.Mock };
  };

  const chatOwnedBy = (userId: string | null) =>
    prisma.chat.findUnique.mockResolvedValue(userId ? { userStep: { userId } } : null);

  const decision = (overrides: Partial<OwnershipDecision> = {}): OwnershipDecision => ({
    actor: { id: 'u-1', role: 'STUDENT' },
    metadata: { resource: 'chat', ownerField: 'userId' },
    request: { method: 'GET', params: { id: 'c-1' } },
    allowAdminBypass: true,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      chat: { findUnique: jest.fn() },
      quiz: { findUnique: jest.fn() },
    };
  });

  it('allows the owner', async () => {
    chatOwnedBy('u-1');

    await expect(assertOwnership(prisma as any, decision())).resolves.toBeUndefined();
  });

  it('rejects another user as not the owner', async () => {
    chatOwnedBy('u-2');

    await expect(assertOwnership(prisma as any, decision())).rejects.toThrow('Not the resource owner');
  });

  it('rejects a missing row as not found', async () => {
    chatOwnedBy(null);

    await expect(assertOwnership(prisma as any, decision())).rejects.toThrow('Resource not found');
  });

  it('rejects a request without an actor', async () => {
    await expect(assertOwnership(prisma as any, decision({ actor: undefined }))).rejects.toThrow(
      'Authentication required',
    );
  });

  it('rejects a request without the resource id', async () => {
    await expect(
      assertOwnership(prisma as any, decision({ request: { method: 'GET', params: { id: '' } } })),
    ).rejects.toThrow('Resource id required');
  });

  it('reads the resource id from the body or the query when the metadata says so', async () => {
    chatOwnedBy('u-1');

    await expect(
      assertOwnership(
        prisma as any,
        decision({
          metadata: { resource: 'chat', ownerField: 'userId', source: 'body', field: 'chatId' },
          request: { method: 'POST', body: { chatId: 'c-1' } },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertOwnership(
        prisma as any,
        decision({
          metadata: { resource: 'chat', ownerField: 'userId', source: 'query', field: 'chatId' },
          request: { method: 'GET', query: { chatId: 'c-1' } },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(prisma.chat.findUnique).toHaveBeenCalledTimes(2);
  });

  describe('with the administrator bypass', () => {
    it('lets an ADMIN through without looking at the resource', async () => {
      await expect(
        assertOwnership(prisma as any, decision({ actor: { id: 'a-1', role: 'ADMIN' } })),
      ).resolves.toBeUndefined();
      expect(prisma.chat.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('without the administrator bypass', () => {
    const admin = { id: 'a-1', role: 'ADMIN' };

    it('rejects an ADMIN who is not the owner', async () => {
      chatOwnedBy('u-2');

      await expect(
        assertOwnership(prisma as any, decision({ actor: admin, allowAdminBypass: false })),
      ).rejects.toThrow('Not the resource owner');
    });

    it('allows an ADMIN who is the owner', async () => {
      chatOwnedBy('a-1');

      await expect(
        assertOwnership(prisma as any, decision({ actor: admin, allowAdminBypass: false })),
      ).resolves.toBeUndefined();
    });

    it('rejects an ADMIN for a missing row', async () => {
      chatOwnedBy(null);

      await expect(
        assertOwnership(prisma as any, decision({ actor: admin, allowAdminBypass: false })),
      ).rejects.toThrow('Resource not found');
    });
  });

  describe('resources without an owner', () => {
    const unowned = (overrides: Partial<OwnershipDecision> = {}) =>
      decision({
        metadata: { resource: 'quiz', ownerField: 'userId', allowUnownedRead: true },
        ...overrides,
      });

    beforeEach(() => {
      prisma.quiz.findUnique.mockResolvedValue({});
    });

    it('allows a GET when the route opts in', async () => {
      await expect(assertOwnership(prisma as any, unowned())).resolves.toBeUndefined();
    });

    it('rejects a write even when the route opts in to reads', async () => {
      await expect(
        assertOwnership(prisma as any, unowned({ request: { method: 'POST', params: { id: 'q-1' } } })),
      ).rejects.toThrow('Not the resource owner');
    });

    it('rejects a GET when the route does not opt in', async () => {
      await expect(
        assertOwnership(
          prisma as any,
          unowned({ metadata: { resource: 'quiz', ownerField: 'userId' } }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
