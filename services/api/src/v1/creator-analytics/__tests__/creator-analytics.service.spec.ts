import { CreatorAnalyticsService } from '../creator-analytics.service';

function buildPrismaStub(overrides: Record<string, unknown> = {}) {
  return {
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      ...((overrides.article as Record<string, unknown>) ?? {}),
    },
    classProduct: {
      findMany: jest.fn().mockResolvedValue([]),
      ...((overrides.classProduct as Record<string, unknown>) ?? {}),
    },
    entitlement: {
      findMany: jest.fn().mockResolvedValue([]),
      ...((overrides.entitlement as Record<string, unknown>) ?? {}),
    },
    episode: {
      findMany: jest.fn().mockResolvedValue([]),
      ...((overrides.episode as Record<string, unknown>) ?? {}),
    },
  };
}

describe('CreatorAnalyticsService', () => {
  describe('AC-194: empty creator returns helpful summary', () => {
    it('returns "no published materials" when no articles or classes', async () => {
      const service = new CreatorAnalyticsService(buildPrismaStub() as never);
      const out = await service.getCreatorDiagnostics('creator-1');
      expect(out.summary).toContain('Tidak ada materi yang sudah terbit');
      expect(out.totalLearners).toBe(0);
      expect(out.activeLearners).toBe(0);
    });
  });

  describe('AC-194: explains without exposing private learner info', () => {
    it('summary mentions concept, failure rate, attempts, never learner names', () => {
      const service = new CreatorAnalyticsService(null as never);
      const summary = (service as unknown as {
        buildSummary: (
          total: number,
          active: number,
          concepts: number,
          struggling: { conceptKey: string; failureRate: number; totalAttempts: number }[],
        ) => string;
      }).buildSummary(
        100,
        25,
        5,
        [{ conceptKey: 'debit-credit', failureRate: 0.7, totalAttempts: 30 }],
      );
      expect(summary).toContain('debit-credit');
      expect(summary).toContain('70%');
      expect(summary).toContain('30');
      expect(summary).not.toMatch(/nama|email|user_id/i);
    });
  });

  describe('AC-194: counts learners from entitlements', () => {
    it('returns totalLearners = unique users with entitlements', async () => {
      const stub = buildPrismaStub({
        article: {
          findMany: jest.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]),
        },
        entitlement: {
          findMany: jest.fn().mockResolvedValue([
            { userId: 'u1', createdAt: new Date(), articleId: 'a1' },
            { userId: 'u2', createdAt: new Date(), articleId: 'a1' },
            { userId: 'u3', createdAt: new Date(), articleId: 'a2' },
          ]),
        },
      });
      const service = new CreatorAnalyticsService(stub as never);
      const out = await service.getCreatorDiagnostics('creator-1');
      expect(out.totalLearners).toBe(3);
    });
  });
});
