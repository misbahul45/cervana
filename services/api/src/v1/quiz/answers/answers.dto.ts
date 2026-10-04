import z from 'zod';
import { extendApi } from '@anatine/zod-openapi';

export const baseAnswerSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required').describe('Related quiz attempt ID'),
  questionId: z.string().min(1, 'Question ID is required').describe('Related question ID'),
  userAnswer: z.unknown().describe('User submitted answer in JSON format'),
});

const single = baseAnswerSchema.strict();
const array = z.array(baseAnswerSchema.strict());

export const CreateAnswerDto = extendApi(z.union([single, array]), {
  title: 'CreateAnswerDto',
  example: [
    {
      attemptId: 'uuid-attempt-1234',
      questionId: 'uuid-question-5678',
      userAnswer: 'Programming Language',
    },
  ],
});

export type CreateAnswerType = z.infer<typeof CreateAnswerDto>;