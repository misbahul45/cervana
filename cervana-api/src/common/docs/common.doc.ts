import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';

// Common parameter schemas
export const UuidParamSchema = extendApi(
  z.object({
    id: z.string().uuid().describe('UUID identifier'),
  }),
  {
    title: 'UuidParam',
    example: { id: 'uuid-123-456-789' }
  }
);

export const StringParamSchema = extendApi(
  z.object({
    id: z.string().describe('String identifier'),
  }),
  {
    title: 'StringParam',
    example: { id: 'string-id' }
  }
);

// Common query schemas
export const SearchQuerySchema = extendApi(
  z.object({
    search: z.string().optional().describe('Search term'),
  }),
  {
    title: 'SearchQuery',
    example: { search: 'search term' }
  }
);

export const DateRangeQuerySchema = extendApi(
  z.object({
    dateFrom: z.string().datetime().optional().describe('Start date (ISO string)'),
    dateTo: z.string().datetime().optional().describe('End date (ISO string)'),
  }),
  {
    title: 'DateRangeQuery',
    example: {
      dateFrom: '2024-01-01T00:00:00.000Z',
      dateTo: '2024-12-31T23:59:59.999Z'
    }
  }
);

export const StatusFilterSchema = extendApi(
  z.object({
    status: z.string().optional().describe('Filter by status'),
  }),
  {
    title: 'StatusFilter',
    example: { status: 'ACTIVE' }
  }
);