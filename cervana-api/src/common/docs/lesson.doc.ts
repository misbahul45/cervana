import { extendApi } from '@anatine/zod-openapi'
import z from 'zod'

export const BaseLessonSchema = z.object({
  id: z.string().describe('Unique lesson identifier'),
  title: z.string().describe('Lesson title'),
  description: z.string().nullable().optional().describe('Optional description of the lesson'),
  sortOrder: z.number().describe('Ordering index for display'),
  subTopicId: z.string().describe('Parent subtopic ID'),
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  lessonThemeId: z.string().optional().describe('Optional related LessonTheme ID'),
})

export const LessonDetailSchema = extendApi(
  BaseLessonSchema.extend({
    steps: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          sortOrder: z.number(),
          createdAt: z.date(),
          updatedAt: z.date(),
          stepThemeId: z.string().optional(),
        })
      )
      .optional()
      .describe('List of steps under this lesson'),
    _count: z
      .object({
        steps: z.number(),
      })
      .optional()
      .describe('Number of steps under this lesson'),
  }),
  {
    title: 'LessonDetail',
    example: {
      id: 'lesson-uuid-1',
      title: 'Introduction to Variables',
      description: 'Basic usage of variables',
      sortOrder: 1,
      subTopicId: 'subtopic-uuid-123',
      createdAt: '2024-01-20T00:00:00Z',
      updatedAt: '2024-08-08T09:00:00Z',
      lessonThemeId: 'lesson-theme-uuid-1',
      steps: [
        {
          id: 'step-uuid-1',
          title: 'Step 1: Declaring Variables',
          description: 'Learn how to declare variables',
          sortOrder: 1,
          createdAt: '2024-01-21T00:00:00Z',
          updatedAt: '2024-08-08T09:10:00Z',
          stepThemeId: 'step-theme-uuid-1',
        },
      ],
      _count: {
        steps: 3,
      },
    },
  }
)

export const LessonsListSchema = extendApi(
  z.object({
    data: z
      .array(
        BaseLessonSchema.extend({
          _count: z
            .object({
              steps: z.number(),
            })
            .optional()
            .describe('Number of steps in this lesson'),
        })
      )
      .describe('List of lessons'),
    pagination: z
      .object({
        page: z.number().describe('Current page number'),
        limit: z.number().describe('Items per page'),
        total: z.number().describe('Total number of lessons'),
        totalPages: z.number().describe('Total number of pages'),
        hasNext: z.boolean().describe('Has next page'),
        hasPrev: z.boolean().describe('Has previous page'),
      })
      .describe('Pagination details'),
  }),
  {
    title: 'LessonsList',
    example: {
      data: [
        {
          id: 'lesson-uuid-1',
          title: 'Introduction to Variables',
          description: 'Basic usage of variables',
          sortOrder: 1,
          subTopicId: 'subtopic-uuid-123',
          createdAt: '2024-01-20T00:00:00Z',
          updatedAt: '2024-08-08T09:00:00Z',
          lessonThemeId: 'lesson-theme-uuid-1',
          _count: { steps: 3 },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 20,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      },
    },
  }
)
