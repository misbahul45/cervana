import { z } from 'zod';

export const ASSESSMENT_COMPLETED = 'ASSESSMENT_COMPLETED';

export const assessmentPayloadSchema = z.object({
  attemptId: z.string().min(1),
  quizId: z.string().min(1),
  score: z.number().min(0).max(1),
  items: z.number().int().min(1),
  hintsUsed: z.number().int().min(0).default(0),
  share: z.number().gt(0).max(1),
  attemptNumber: z.number().int().min(1),
  difficulty: z.number().optional(),
});

export type AssessmentPayload = z.infer<typeof assessmentPayloadSchema>;
