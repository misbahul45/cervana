import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

// Base schema (sesuai model Topic di Prisma, tanpa relasi penuh)
export const BaseTopicSchema = z.object({
  id: z.string().describe('Unique topic identifier'),
  title: z.string().describe('Topic title'),
  slug: z.string().describe('URL-friendly slug for the topic'),
  description: z.string().nullable().optional().describe('Optional description of the topic'),

  categoryId: z.string().describe('Parent category ID'),

  isFree: z.boolean().describe('Whether the topic is free'),
  price: z.number().describe('Price of the topic'),

  createdBy: z.string().describe('User ID of the topic creator'),
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
});

// Detail schema (dengan subTopics, teacher, dan count)
export const TopicDetailSchema = extendApi(
  BaseTopicSchema.extend({
    subTopics: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    ).optional().describe('List of subtopics under this topic'),

    teacher: z
      .object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
      })
      .nullable()
      .optional()
      .describe('Teacher who created this topic'),

    _count: z
      .object({
        subTopics: z.number(),
        userTopics: z.number().optional(),
      })
      .optional()
      .describe('Number of related entities for this topic'),
  }),
  {
    title: 'TopicDetail',
    example: {
      id: 'topic-uuid-123',
      title: 'Introduction to JavaScript',
      slug: 'introduction-to-javascript',
      description: 'Basics of JavaScript programming',
      categoryId: 'category-uuid-123',
      isFree: true,
      price: 0,
      createdBy: 'user-uuid-111',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-08-08T11:00:00Z',
      subTopics: [
        {
          id: 'subtopic-uuid-1',
          title: 'Variables & Data Types',
          description: 'Understanding variables and primitive types',
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-08-08T10:00:00Z',
        },
      ],
      teacher: {
        id: 'user-uuid-111',
        name: 'John Doe',
        email: 'john@example.com',
      },
      _count: {
        subTopics: 1,
        userTopics: 10,
      },
    },
  }
);

// List schema (untuk daftar topics + pagination)
export const TopicsListSchema = extendApi(
  z.object({
    data: z.array(
      BaseTopicSchema.extend({
        _count: z
          .object({
            subTopics: z.number(),
          })
          .optional()
          .describe('Number of subtopics in this topic'),
      })
    ).describe('List of topics'),

    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of topics'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination details'),
  }),
  {
    title: 'TopicsList',
    example: {
      data: [
        {
          id: 'topic-uuid-123',
          title: 'Introduction to JavaScript',
          slug: 'introduction-to-javascript',
          description: 'Basics of JavaScript programming',
          categoryId: 'category-uuid-123',
          isFree: true,
          price: 0,
          createdBy: 'user-uuid-111',
          createdAt: '2024-01-10T00:00:00Z',
          updatedAt: '2024-08-08T11:00:00Z',
          _count: {
            subTopics: 5,
          },
        },
        {
          id: 'topic-uuid-456',
          title: 'Advanced CSS Techniques',
          slug: 'advanced-css-techniques',
          description: 'Deep dive into modern CSS features',
          categoryId: 'category-uuid-456',
          isFree: false,
          price: 49.99,
          createdBy: 'user-uuid-222',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-08-08T15:00:00Z',
          _count: {
            subTopics: 3,
          },
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
