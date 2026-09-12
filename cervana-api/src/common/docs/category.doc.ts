import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

export const BaseCategorySchema = z.object({
  id: z.string().describe('Unique category identifier'),
  name: z.string().describe('Category name'),
  slug: z.string().describe('URL-friendly slug'),
  description: z.string().nullable().optional().describe('Optional description of the category'),

  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
});

export const CategoryDetailSchema = extendApi(
  BaseCategorySchema.extend({
    topics: z.array(z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      createdAt: z.date(),
      updatedAt: z.date()
    })).optional().describe('List of related topics'),

    _count: z.object({
      topics: z.number()
    }).optional().describe('Number of topics under this category'),
  }),
  {
    title: 'CategoryDetail',
    example: {
      id: 'category-uuid-123',
      name: 'Programming',
      slug: 'programming',
      description: 'All programming-related content',
      sortOrder: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-08-08T12:00:00Z',
      topics: [
        {
          id: 'topic-uuid-123',
          title: 'Introduction to JavaScript',
          slug: 'introduction-to-javascript',
          description: 'Basics of JavaScript programming',
          difficultyLevel: 'BEGINNER',
          createdAt: '2024-01-10T00:00:00Z',
          updatedAt: '2024-08-08T11:00:00Z',
        }
      ],
      _count: {
        topics: 1
      }
    }
  }
);

export const CategoriesListSchema = extendApi(
  z.object({
    data: z.array(BaseCategorySchema.extend({
      _count: z.object({
        topics: z.number()
      }).optional().describe('Number of topics in this category')
    })).describe('List of categories'),

    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of categories'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination details')
  }),
  {
    title: 'CategoriesList',
    example: {
      data: [
        {
          id: 'category-uuid-123',
          name: 'Programming',
          slug: 'programming',
          description: 'All programming-related content',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-08-08T12:00:00Z',
          _count: {
            topics: 10
          }
        },
        {
          id: 'category-uuid-456',
          name: 'Design',
          slug: 'design',
          description: 'UI/UX design topics',
          createdAt: '2024-01-05T00:00:00Z',
          updatedAt: '2024-08-08T12:30:00Z',
          _count: {
            topics: 5
          }
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      }
    }
  }
);
