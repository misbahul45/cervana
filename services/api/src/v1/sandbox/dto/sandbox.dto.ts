import { z } from 'zod';

export const ListScenariosQuerySchema = z.object({
  level: z.coerce.number().int().min(1).max(4).optional(),
  topicId: z.string().min(1).optional(),
});
export type ListScenariosQuery = z.infer<typeof ListScenariosQuerySchema>;

export const ValidateJournalSchema = z.object({
  attemptId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        side: z.enum(['DEBIT', 'CREDIT']),
        amount: z.number().positive(),
      }),
    )
    .min(2)
    .optional(),
  entries: z
    .array(
      z.object({
        debitAccount: z.string().min(1),
        creditAccount: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1)
    .optional(),
});
export type ValidateJournalDto = z.infer<typeof ValidateJournalSchema>;

export interface SandboxScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  level: 1 | 2 | 3 | 4;
  topicId: string;
  expectedLines: Array<{
    accountId: string;
    side: 'DEBIT' | 'CREDIT';
    amount: number;
  }>;
}

export const SandboxGraphSchema = z.object({
  levels: z.array(
    z.object({
      id: z.number().int().min(1).max(4),
      title: z.string(),
      topics: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().optional(),
          prerequisites: z.array(z.string()).default([]),
          estimatedMinutes: z.number().int().positive().optional(),
        }),
      ),
    }),
  ),
});
export type SandboxGraph = z.infer<typeof SandboxGraphSchema>;