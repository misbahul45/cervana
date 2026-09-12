import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

export const BaseAnswerSchema = z.object({
  id: z.string().describe('Unique answer identifier'),
  attemptId: z.string().describe('Related attempt ID'),
  questionId: z.string().describe('Related question ID'),
  userAnswer: z.any().describe('User submitted answer'),
  isCorrect: z.boolean().describe('Whether the answer is correct'),
  pointsEarned: z.number().describe('Points earned for this answer'),
});

export const AnswerListSchema = extendApi(
  z.object({
    data: z.array(BaseAnswerSchema).describe('List of answers'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of answers'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Whether there is a next page'),
      hasPrev: z.boolean().describe('Whether there is a previous page'),
    }).describe('Pagination details'),
  }),
  {
    title: 'AnswerList',
    example: {
      data: [
        {
          id: 'ans-uuid-123',
          attemptId: 'attempt-uuid-123',
          questionId: 'question-uuid-123',
          userAnswer: { choice: 'A' },
          isCorrect: true,
          pointsEarned: 10,
        },
        {
          id: 'ans-uuid-124',
          attemptId: 'attempt-uuid-123',
          questionId: 'question-uuid-124',
          userAnswer: { choice: 'B' },
          isCorrect: false,
          pointsEarned: 0,
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    },
  }
);
