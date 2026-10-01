export interface RecommendationSignals {
  matchesGoal: boolean;
  matchesDifficulty: boolean;
  matchesPrerequisites: boolean;
  novelty: number;
  engagement: number;
}

export interface ArticleCandidate {
  kind: 'article';
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryId: string | null;
  authorId: string;
  tenantId: string;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  publishedAt: string | null;
}

export interface ClassCandidate {
  kind: 'class';
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructorId: string;
  tenantId: string;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  publishedAt: string | null;
  format: string;
}

export type ProductCandidate = ArticleCandidate | ClassCandidate;

export interface Recommendation {
  product: ProductCandidate;
  score: number;
  reason: string;
  signals: RecommendationSignals;
}
