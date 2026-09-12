import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

export const BaseStepSchema = z.object({
  id: z.string().describe('Unique step identifier'),
  title: z.string().describe('Step title'),
  description: z.string().nullable().optional().describe('Optional description of the step'),
  sortOrder: z.number().describe('Ordering index for display'),
  lessonId: z.string().describe('Parent lesson ID'),
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
});

export const StepDetailSchema = extendApi(
  BaseStepSchema.extend({
    contents: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        data: z.any(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    ).optional().describe('List of contents in this step'),
    quiz: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }).nullable().optional().describe('Quiz associated with this step'),
    _count: z.object({
      contents: z.number()
    }).optional().describe('Number of contents in this step'),
  }),
  {
    title: 'StepDetail',
    example: {
      id: 'step-uuid-1',
      title: 'Step 1: Declaring Variables',
      description: 'Learn how to declare variables in JavaScript',
      sortOrder: 1,
      lessonId: 'lesson-uuid-123',
      createdAt: '2024-01-21T00:00:00Z',
      updatedAt: '2024-08-08T09:10:00Z',
      contents: [
        {
          id: 'content-uuid-1',
          title: 'Video: Declaring Variables',
          type: 'video',
          data: { url: 'https://example.com/video.mp4' },
          createdAt: '2024-01-21T00:00:00Z',
          updatedAt: '2024-08-08T09:15:00Z'
        }
      ],
      quiz: {
        id: 'quiz-uuid-1',
        title: 'Variables Quiz',
        description: 'Test your knowledge about variables',
        createdAt: '2024-01-21T00:00:00Z',
        updatedAt: '2024-08-08T09:20:00Z'
      },
      _count: { contents: 2 }
    }
  }
);

export const StepsListSchema = extendApi(
  z.object({
    data: z.array(BaseStepSchema.extend({
      _count: z.object({
        contents: z.number()
      }).optional().describe('Number of contents in this step')
    })).describe('List of steps'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of steps'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination details')
  }),
  {
    title: 'StepsList',
    example: {
      data: [
        {
          id: 'step-uuid-1',
          title: 'Step 1: Declaring Variables',
          description: 'Learn how to declare variables in JavaScript',
          sortOrder: 1,
          lessonId: 'lesson-uuid-123',
          createdAt: '2024-01-21T00:00:00Z',
          updatedAt: '2024-08-08T09:10:00Z',
          _count: { contents: 2 }
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 20,
        totalPages: 2,
        hasNext: true,
        hasPrev: false
      }
    }
  }
);
