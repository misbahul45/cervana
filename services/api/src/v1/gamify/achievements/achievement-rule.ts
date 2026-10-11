import { z } from 'zod';

export const ACHIEVEMENT_METRICS = [
  'ASSESSMENTS_COMPLETED',
  'CONCEPTS_PASSED',
  'NODES_MASTERED',
  'STREAK_DAYS',
  'LEVEL',
  'XP_TOTAL',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

const achievementRuleSchema = z
  .object({
    metric: z.enum(ACHIEVEMENT_METRICS),
    op: z.literal('>='),
    value: z.number().int().positive(),
  })
  .strict();

export type AchievementRule = z.infer<typeof achievementRuleSchema>;

export const parseAchievementRule = (input: unknown): AchievementRule | null => {
  const parsed = achievementRuleSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};

export const ruleSatisfied = (rule: AchievementRule, value: number): boolean => value >= rule.value;
