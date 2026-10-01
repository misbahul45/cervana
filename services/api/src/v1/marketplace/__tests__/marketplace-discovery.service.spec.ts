import {
  MarketplaceDiscoveryService,
  masteryToPreferredDifficulty,
} from '../marketplace-discovery.service';
import { ClassDifficulty } from '@prisma/client';

describe('MarketplaceDiscoveryService', () => {
  const service = new MarketplaceDiscoveryService(null as never);

  describe('masteryToPreferredDifficulty', () => {
    it('BEGINNER for low mastery', () => {
      expect(masteryToPreferredDifficulty(0)).toBe(ClassDifficulty.BEGINNER);
      expect(masteryToPreferredDifficulty(0.3)).toBe(ClassDifficulty.BEGINNER);
    });

    it('INTERMEDIATE for 0.4-0.7 mastery', () => {
      expect(masteryToPreferredDifficulty(0.4)).toBe(ClassDifficulty.INTERMEDIATE);
      expect(masteryToPreferredDifficulty(0.7)).toBe(ClassDifficulty.INTERMEDIATE);
    });

    it('ADVANCED for >=0.75 mastery', () => {
      expect(masteryToPreferredDifficulty(0.8)).toBe(ClassDifficulty.ADVANCED);
      expect(masteryToPreferredDifficulty(1)).toBe(ClassDifficulty.ADVANCED);
    });
  });

  describe('AC-85: Learning relevance WINS over clicks/revenue', () => {
    const beginnerLearner = {
      userId: 'u1',
      averageMastery: 0.2,
      preferredDifficulty: ClassDifficulty.BEGINNER,
      activeTopicIds: [],
      completedSubTopicIds: [],
    };

    it('free BEGINNER class scores higher than paid BEGINNER for BEGINNER learner', () => {
      const freeBeginner = service['scoreClass'](
        {
          id: 'c1',
          title: 'Free',
          slug: 'free',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'FREE' as never,
          price: null,
          difficulty: ClassDifficulty.BEGINNER,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      const paidBeginner = service['scoreClass'](
        {
          id: 'c2',
          title: 'Paid',
          slug: 'paid',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'PAID' as never,
          price: 50000,
          difficulty: ClassDifficulty.BEGINNER,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      expect(freeBeginner.score).toBeGreaterThan(paidBeginner.score);
    });

    it('matched-difficulty beats mismatched one for same mastery', () => {
      const matched = service['scoreClass'](
        {
          id: 'c1',
          title: 'Matched',
          slug: 'm',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'FREE' as never,
          price: null,
          difficulty: ClassDifficulty.BEGINNER,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      const advanced = service['scoreClass'](
        {
          id: 'c2',
          title: 'Advanced',
          slug: 'a',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'FREE' as never,
          price: null,
          difficulty: ClassDifficulty.ADVANCED,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      expect(matched.score).toBeGreaterThan(advanced.score);
    });

    it('free BEGINNER scores higher than paid ADVANCED for BEGINNER learner', () => {
      const free = service['scoreClass'](
        {
          id: 'c1',
          title: 'F',
          slug: 'f',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'FREE' as never,
          price: null,
          difficulty: ClassDifficulty.BEGINNER,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      const paidAdvanced = service['scoreClass'](
        {
          id: 'c2',
          title: 'P',
          slug: 'p',
          description: null,
          instructorId: 'i1',
          tenantId: 't1',
          accessType: 'PAID' as never,
          price: 999999,
          difficulty: ClassDifficulty.ADVANCED,
          publishedAt: new Date(),
          format: 'RECORDED',
        },
        beginnerLearner,
        ClassDifficulty.BEGINNER,
      );
      expect(free.score).toBeGreaterThan(paidAdvanced.score);
    });
  });

  describe('AC-195: Marketplace explainability', () => {
    it('produces a human-readable recommendation reason with title', () => {
      const reason = service['scoreArticle'](
        {
          id: 'a1',
          title: 'Dasar Akuntansi',
          slug: 'dasar',
          excerpt: null,
          categoryId: null,
          authorId: 'au',
          tenantId: 't',
          accessType: 'FREE' as never,
          price: null,
          publishedAt: new Date(),
        },
        {
          userId: 'u1',
          averageMastery: 0.2,
          preferredDifficulty: ClassDifficulty.BEGINNER,
          activeTopicIds: [],
          completedSubTopicIds: [],
        },
        ClassDifficulty.BEGINNER,
      );
      expect(reason.reason).toMatch(/Dasar Akuntansi/);
      expect(reason.reason).toMatch(/relevansi/);
    });

    it('does NOT claim magic or "AI knows you better" without evidence', () => {
      const reason = service['scoreArticle'](
        {
          id: 'a1',
          title: 'Test',
          slug: 'test',
          excerpt: null,
          categoryId: null,
          authorId: 'au',
          tenantId: 't',
          accessType: 'FREE' as never,
          price: null,
          publishedAt: new Date(),
        },
        {
          userId: 'u1',
          averageMastery: 0.5,
          preferredDifficulty: ClassDifficulty.INTERMEDIATE,
          activeTopicIds: [],
          completedSubTopicIds: [],
        },
        ClassDifficulty.INTERMEDIATE,
      );
      expect(reason.reason).not.toContain('AI knows you');
      expect(reason.reason).not.toContain('magic');
    });
  });
});
