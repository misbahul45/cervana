import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

// Base schema (tanpa relasi)
export const BaseSubTopicSchema = z.object({
  id: z.string().describe('Unique subtopic identifier'),
  title: z.string().describe('Subtopic title'),
  description: z.string().nullable().optional().describe('Optional description of the subtopic'),
  sortOrder: z.number().describe('Ordering index for display'),

  topicId: z.string().describe('Parent topic ID'),

  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
});

// Detail schema (dengan lessons dan count)
export const SubTopicDetailSchema = extendApi(
  BaseSubTopicSchema.extend({
    lessons: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      sortOrder: z.number(),
      createdAt: z.date(),
      updatedAt: z.date()
    })).optional().describe('List of lessons under this subtopic'),

    _count: z.object({
      lessons: z.number()
    }).optional().describe('Number of lessons under this subtopic'),
  }),
  {
    title: 'SubTopicDetail',
    example: {
      id: 'subtopic-uuid-1',
      title: 'Variables & Data Types',
      description: 'Understanding variables and primitive types',
      sortOrder: 1,
      topicId: 'topic-uuid-123',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-08-08T10:00:00Z',
      lessons: [
        {
          id: 'lesson-uuid-1',
          title: 'Introduction to Variables',
          description: 'Basic usage of variables',
          sortOrder: 1,
          createdAt: '2024-01-20T00:00:00Z',
          updatedAt: '2024-08-08T09:00:00Z'
        }
      ],
      _count: {
        lessons: 1
      }
    }
  }
);

// List schema (dengan pagination)
export const SubTopicsListSchema = extendApi(
  z.object({
    data: z.array(BaseSubTopicSchema.extend({
      _count: z.object({
        lessons: z.number()
      }).optional().describe('Number of lessons in this subtopic')
    })).describe('List of subtopics'),

    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of subtopics'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination details')
  }),
  {
    title: 'SubTopicsList',
    example: {
      data: [
        {
          id: 'subtopic-uuid-1',
          title: 'Variables & Data Types',
          description: 'Understanding variables and primitive types',
          sortOrder: 1,
          topicId: 'topic-uuid-123',
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-08-08T10:00:00Z',
          _count: {
            lessons: 4
          }
        },
        {
          id: 'subtopic-uuid-2',
          title: 'Functions & Scope',
          description: 'Understanding functions, parameters, and scope',
          sortOrder: 2,
          topicId: 'topic-uuid-123',
          createdAt: '2024-02-05T00:00:00Z',
          updatedAt: '2024-08-08T14:00:00Z',
          _count: {
            lessons: 3
          }
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
