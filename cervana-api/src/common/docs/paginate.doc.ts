import { z, ZodSchema } from 'zod';
import { extendApi } from '@anatine/zod-openapi';

export const PaginationMetaSchema = extendApi(
  z.object({
    currentPage: z.number().int().positive().describe('Current page number'),
    perPage: z.number().int().positive().describe('Items per page'),
    total: z.number().int().nonnegative().describe('Total number of items'),
    totalPages: z.number().int().nonnegative().describe('Total number of pages'),
    hasNext: z.boolean().describe('Whether there is a next page'),
    hasPrev: z.boolean().describe('Whether there is a previous page'),
  }),
  {
    title: 'PaginationMeta',
    example: {
      currentPage: 1,
      perPage: 10,
      total: 100,
      totalPages: 10,
      hasNext: true,
      hasPrev: false
    }
  }
);

export const PaginationQuerySchema = extendApi(
  z.object({
    page: z.coerce.number().int().positive().default(1).describe('Page number'),
    limit: z.coerce.number().int().positive().max(100).default(10).describe('Items per page'),
    search: z.string().optional().describe('Search query'),
    sortBy: z.string().optional().describe('Sort field'),
    sortOrder: z.enum(['asc', 'desc']).default('asc').describe('Sort order'),
  }),
  {
    title: 'PaginationQuery',
    example: {
      page: 1,
      limit: 10,
      search: 'search term',
      sortBy: 'name',
      sortOrder: 'asc'
    }
  }
);

// Function untuk membuat paginated response schema
export const createPaginatedSchema = <T extends ZodSchema>(itemSchema: T, title?: string) => {
  return extendApi(
    z.object({
      items: z.array(itemSchema).describe('Array of items'),
      pagination: PaginationMetaSchema.describe('Pagination metadata'),
    }),
    {
      title: title ? `Paginated${title}` : 'PaginatedResponse'
    }
  );
};
