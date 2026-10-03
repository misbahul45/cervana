import z from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { AttemptStatus } from '@prisma/client';

export const AttemptStatusEnum = z.enum(AttemptStatus).describe('Status of the quiz attempt');

export const baseQuizAttemptSchema = z.object({
  userId: z.string().min(1, 'User ID is required').describe('User ID who attempts the quiz'),
  quizId: z.string().min(1, 'Quiz ID is required').describe('Related quiz ID'),
  attemptNumber: z.number().int().min(1).default(1).describe('Attempt count for this user on the quiz'),
});

export const CreateQuizAttemptDto = extendApi(
  z.union([baseQuizAttemptSchema, z.array(baseQuizAttemptSchema)]),
  {
    title: 'CreateQuizAttemptDto',
    example: [
      {
        userId: 'uuid-user-1234',
        quizId: 'uuid-quiz-5678',
        attemptNumber: 1,
      },
      {
        userId: 'uuid-user-9876',
        quizId: 'uuid-quiz-4321',
        attemptNumber: 2,
      },
    ],
  }
);

export type CreateQuizAttemptType = z.infer<typeof CreateQuizAttemptDto>;

export const StartQuizAttemptDto = extendApi(
  z.object({
    quizId: z.string().min(1, 'Quiz ID is required'),
  }),
  {
    title: 'StartQuizAttemptDto',
    example: { quizId: 'uuid-quiz-5678' },
  }
);

export type StartQuizAttemptDtoType = z.infer<typeof StartQuizAttemptDto>;

export const SubmitQuizAttemptDto = extendApi(
  z.object({
    answers: z.record(
      z.string().min(1, 'Question ID is required'),
      z.unknown(),
    ),
    hintUsed: z.boolean().optional().default(false),
  }),
  {
    title: 'SubmitQuizAttemptDto',
    example: {
      answers: {
        'uuid-question-1': 'A',
        'uuid-question-2': 'Inheritance',
        'uuid-question-3': true,
      },
      hintUsed: false,
    },
  }
);

export type SubmitQuizAttemptDtoType = z.infer<typeof SubmitQuizAttemptDto>;
