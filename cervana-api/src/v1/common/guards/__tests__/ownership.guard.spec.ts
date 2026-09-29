import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from '../ownership.guard';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reflector: Reflector;
  let prisma: {
    chat: { findUnique: jest.Mock };
    content: { findUnique: jest.Mock };
    userStep: { findUnique: jest.Mock };
    chatMessage: { findUnique: jest.Mock };
  };

  const mockCtx = (user: unknown, params: { id: string }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      chat: { findUnique: jest.fn() },
      content: { findUnique: jest.fn() },
      userStep: { findUnique: jest.fn() },
      chatMessage: { findUnique: jest.fn() },
    };
    guard = new OwnershipGuard(reflector, prisma as any);
  });

  describe('no @RequireOwnership metadata', () => {
    it('allows through', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'c-1' })),
      ).resolves.toBe(true);
    });
  });

  describe('chat resource', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ resource: 'chat', ownerField: 'userId' });
    });

    it('rejects unauthenticated request', async () => {
      await expect(
        guard.canActivate(mockCtx(null, { id: 'c-1' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when resource id missing', async () => {
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: '' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'c-x' })),
      ).rejects.toThrow(/Resource not found/);
    });

    it('rejects when user does not own chat', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        userStep: { userId: 'u-other' },
      });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'c-1' })),
      ).rejects.toThrow(/Not the resource owner/);
    });

    it('allows when user owns chat', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        userStep: { userId: 'u-1' },
      });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'c-1' })),
      ).resolves.toBe(true);
    });

    it('allows when user is ADMIN regardless of ownership', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        userStep: { userId: 'u-other' },
      });
      await expect(
        guard.canActivate(
          mockCtx({ id: 'admin-1', role: 'ADMIN' }, { id: 'c-1' }),
        ),
      ).resolves.toBe(true);
    });
  });

  describe('user-step resource', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ resource: 'user-step', ownerField: 'userId' });
    });

    it('checks userStep.userId', async () => {
      prisma.userStep.findUnique.mockResolvedValue({ userId: 'u-1' });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 's-1' })),
      ).resolves.toBe(true);
      expect(prisma.userStep.findUnique).toHaveBeenCalledWith({
        where: { id: 's-1' },
        select: { userId: true },
      });
    });
  });

  describe('content resource', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ resource: 'content', ownerField: 'userId' });
    });

    it('walks content → message → chat → userStep', async () => {
      prisma.content.findUnique.mockResolvedValue({
        message: {
          chat: { userStep: { userId: 'u-1' } },
        },
      });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'c-1' })),
      ).resolves.toBe(true);
    });
  });

  describe('message resource', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ resource: 'message', ownerField: 'userId' });
    });

    it('walks message → chat → userStep', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({
        chat: { userStep: { userId: 'u-1' } },
      });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'm-1' })),
      ).resolves.toBe(true);
    });
  });

  describe('unknown resource', () => {
    it('rejects with resource-not-found', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ resource: 'lesson-progress' as any, ownerField: 'userId' });
      await expect(
        guard.canActivate(mockCtx({ id: 'u-1' }, { id: 'lp-1' })),
      ).rejects.toThrow(/Resource not found/);
    });
  });
});