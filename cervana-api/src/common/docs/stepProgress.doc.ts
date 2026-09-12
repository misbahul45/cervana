import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

// Base schema (tanpa relasi)
export const BaseStepProgressSchema = z.object({
  id: z.string().describe('Unique step progress identifier'),
  userId: z.string().describe('User ID linked to this progress'),
  stepId: z.string().describe('Step ID linked to this progress'),
  isCompleted: z.boolean().default(false).describe('Whether the step is completed'),
});

// Detail schema (dengan relasi opsional)
export const StepProgressDetailSchema = extendApi(
  BaseStepProgressSchema.extend({
    step: z
      .object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable().optional(),
        sortOrder: z.number(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
      .optional()
      .describe('Optional step details for this progress'),

    user: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
      .optional()
      .describe('Optional user details for this progress'),
  }),
  {
    title: 'StepProgressDetail',
    example: {
      id: 'progress-uuid-1',
      userId: 'user-uuid-123',
      stepId: 'step-uuid-456',
      isCompleted: true,
      step: {
        id: 'step-uuid-456',
        title: 'Intro to Loops',
        description: 'Learn about for and while loops',
        sortOrder: 1,
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-08-08T10:00:00Z',
      },
      user: {
        id: 'user-uuid-123',
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
  }
);

// List schema (dengan pagination)
export const StepProgressListSchema = extendApi(
  z.object({
    data: z.array(BaseStepProgressSchema).describe('List of step progress records'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of step progress records'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }),
  }),
  {
    title: 'StepProgressList',
    example: {
      data: [
        {
          id: 'progress-uuid-1',
          userId: 'user-uuid-123',
          stepId: 'step-uuid-456',
          isCompleted: false,
        },
        {
          id: 'progress-uuid-2',
          userId: 'user-uuid-123',
          stepId: 'step-uuid-789',
          isCompleted: true,
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      },
    },
  }
);
