import { CreatorProfileService } from '../creator-profile.service';

describe('CreatorProfileService.build', () => {
  let service: CreatorProfileService;

  beforeEach(() => {
    const prisma = {
      teacherApplication: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'u1',
          fullName: 'Test',
          bio: '...',
          portfolioUrl: 'https://example.com',
        }),
      },
      article: { findMany: jest.fn().mockResolvedValue([]) },
      classProduct: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CreatorProfileService(prisma as any);
  });

  it('returns the user name, bio, articles, classes, badges', async () => {
    const out = await service.build('u1');
    expect(out).toMatchObject({ id: 'u1', fullName: 'Test' });
  });

  it('returns null when no approved application exists', async () => {
    (service as any).prisma.teacherApplication.findFirst.mockResolvedValue(null);
    const out = await service.build('u9');
    expect(out).toBeNull();
  });

  describe('what a visitor may see', () => {
    const calls = (name: 'article' | 'classProduct') => ((service as any).prisma[name].findMany as jest.Mock).mock.calls[0][0];

    it('lists only published products of active tenants for that author or instructor', async () => {
      await service.build('u1');

      expect(calls('article').where).toEqual({ authorId: 'u1', status: 'PUBLISHED', tenant: { status: 'ACTIVE' } });
      expect(calls('classProduct').where).toEqual({ instructorId: 'u1', status: 'PUBLISHED', tenant: { status: 'ACTIVE' } });
    });

    it('selects public listing fields only, never moderation notes, tenant ids or version pointers', async () => {
      await service.build('u1');

      for (const name of ['article', 'classProduct'] as const) {
        const { select } = calls(name);
        expect(select).toBeDefined();
        for (const hidden of ['reviewNote', 'reviewedById', 'tenantId', 'submittedAt', 'status', 'publishedVersionId', 'createdById']) {
          expect(select).not.toHaveProperty(hidden);
        }
        expect(select).toMatchObject({ id: true, title: true, accessType: true, price: true, currency: true });
      }
    });

    it('returns badges as title, description and icon only', async () => {
      (service as any).prisma.userAchievement.findMany.mockResolvedValue([
        {
          id: 'ua1',
          userId: 'u1',
          awardedAt: new Date('2026-10-01T00:00:00Z'),
          achievement: { id: 'a1', title: 'Streak 7', description: 'Tujuh hari', icon: null, iconName: 'streak', condition: 'internal', rule: { secret: 1 } },
        },
      ]);

      const out = await service.build('u1');

      expect(out?.badges).toEqual([
        { id: 'a1', title: 'Streak 7', description: 'Tujuh hari', icon: null, iconName: 'streak', awardedAt: new Date('2026-10-01T00:00:00Z') },
      ]);
    });
  });
});
