import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from '../ownership.guard';
import { OWNER_RESOLVERS, OwnedResource } from '../ownership.registry';

describe('ownership registry', () => {
  let reflector: Reflector;
  let guard: OwnershipGuard;
  let findUnique: jest.Mock;
  let prisma: any;

  const ctx = (
    user: unknown,
    req: { params?: Record<string, string>; body?: Record<string, unknown>; method?: string },
  ) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user, method: 'GET', params: {}, body: {}, ...req }) }),
    }) as unknown as ExecutionContext;

  const meta = (resource: OwnedResource, extra: object = {}) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ resource, ownerField: 'userId', ...extra });

  beforeEach(() => {
    reflector = new Reflector();
    findUnique = jest.fn();
    prisma = new Proxy({}, { get: () => ({ findUnique }) });
    guard = new OwnershipGuard(reflector, prisma);
  });

  const directResources: Array<[OwnedResource, object]> = [
    ['user-step', { userId: 'owner' }],
    ['lesson-progress', { userId: 'owner' }],
    ['subtopic-progress', { userId: 'owner' }],
    ['step-progress', { userId: 'owner' }],
    ['user-topic', { userId: 'owner' }],
    ['quiz-attempt', { userId: 'owner' }],
    ['personality-quiz', { userId: 'owner' }],
    ['daily-log', { userId: 'owner' }],
    ['streak', { userId: 'owner' }],
    ['teacher-application', { userId: 'owner' }],
    ['answer', { attempt: { userId: 'owner' } }],
    ['learning-style', { userTopic: { userId: 'owner' } }],
    ['teacher-experience', { teacherApplication: { userId: 'owner' } }],
    ['teacher-certification', { teacherApplication: { userId: 'owner' } }],
    ['quiz', { stepProgress: { userId: 'owner' } }],
    ['question', { quiz: { userStepProgress: { userId: 'owner' } } }],
    ['notification', { userId: 'owner', isGlobal: false }],
    ['content', { chat: { userStep: { userId: 'owner' } } }],
  ];

  describe.each(directResources)('%s', (resource, row) => {
    beforeEach(() => {
      meta(resource);
      findUnique.mockResolvedValue(row);
    });

    it('allows the owner', async () => {
      await expect(guard.canActivate(ctx({ id: 'owner', role: 'STUDENT' }, { params: { id: 'r-1' } }))).resolves.toBe(true);
    });

    it('rejects a different STUDENT', async () => {
      await expect(guard.canActivate(ctx({ id: 'intruder', role: 'STUDENT' }, { params: { id: 'r-1' } }))).rejects.toThrow(ForbiddenException);
    });

    it('rejects a TEACHER who is not the owner', async () => {
      await expect(guard.canActivate(ctx({ id: 'teacher', role: 'TEACHER' }, { params: { id: 'r-1' } }))).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN', async () => {
      await expect(guard.canActivate(ctx({ id: 'admin', role: 'ADMIN' }, { params: { id: 'r-1' } }))).resolves.toBe(true);
    });

    it('rejects when the row does not exist', async () => {
      findUnique.mockResolvedValue(null);
      await expect(guard.canActivate(ctx({ id: 'owner', role: 'STUDENT' }, { params: { id: 'r-1' } }))).rejects.toThrow(/Resource not found/);
    });
  });

  describe('unowned (global template) resources', () => {
    it('blocks writes by non-admins', async () => {
      meta('quiz', { allowUnownedRead: true });
      findUnique.mockResolvedValue({ stepProgress: null });
      await expect(
        guard.canActivate(ctx({ id: 'u', role: 'STUDENT' }, { params: { id: 'q' }, method: 'PATCH' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows GET only when the route opts in', async () => {
      findUnique.mockResolvedValue({ stepProgress: null });
      meta('quiz', { allowUnownedRead: true });
      await expect(
        guard.canActivate(ctx({ id: 'u', role: 'STUDENT' }, { params: { id: 'q' }, method: 'GET' })),
      ).resolves.toBe(true);
      meta('quiz');
      await expect(
        guard.canActivate(ctx({ id: 'u', role: 'STUDENT' }, { params: { id: 'q' }, method: 'GET' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('global notifications are readable but not writable', async () => {
      findUnique.mockResolvedValue({ userId: null, isGlobal: true });
      meta('notification', { allowUnownedRead: true });
      await expect(
        guard.canActivate(ctx({ id: 'u', role: 'STUDENT' }, { params: { id: 'n' }, method: 'GET' })),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(ctx({ id: 'u', role: 'STUDENT' }, { params: { id: 'n' }, method: 'DELETE' })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('parent ownership taken from the request body', () => {
    it('rejects creating a child under another user parent', async () => {
      meta('quiz-attempt', { source: 'body', field: 'attemptId' });
      findUnique.mockResolvedValue({ userId: 'owner' });
      await expect(
        guard.canActivate(ctx({ id: 'intruder', role: 'STUDENT' }, { body: { attemptId: 'a-1' }, method: 'POST' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the parent owner', async () => {
      meta('quiz-attempt', { source: 'body', field: 'attemptId' });
      findUnique.mockResolvedValue({ userId: 'owner' });
      await expect(
        guard.canActivate(ctx({ id: 'owner', role: 'STUDENT' }, { body: { attemptId: 'a-1' }, method: 'POST' })),
      ).resolves.toBe(true);
    });

    it('fails closed when the body field is missing or not a string', async () => {
      meta('quiz-attempt', { source: 'body', field: 'attemptId' });
      await expect(guard.canActivate(ctx({ id: 'owner', role: 'STUDENT' }, { body: {}, method: 'POST' }))).rejects.toThrow(ForbiddenException);
      await expect(
        guard.canActivate(ctx({ id: 'owner', role: 'STUDENT' }, { body: { attemptId: { id: 'a' } }, method: 'POST' })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('has a resolver for every declared resource name', () => {
    for (const [resource] of directResources) {
      expect(typeof OWNER_RESOLVERS[resource]).toBe('function');
    }
    for (const resource of ['chat', 'message'] as OwnedResource[]) {
      expect(typeof OWNER_RESOLVERS[resource]).toBe('function');
    }
  });
});
