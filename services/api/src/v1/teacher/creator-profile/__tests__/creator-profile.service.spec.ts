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
});