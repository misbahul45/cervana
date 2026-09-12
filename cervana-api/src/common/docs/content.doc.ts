import { extendApi } from '@anatine/zod-openapi';
import z from 'zod';

// =====================================================================
// 1. Base Content Schema
// =====================================================================
export const BaseContentSchema = z.object({
  id: z.string().describe('Unique content identifier'),
  stepId: z.string().describe('Related step ID'),
  data: z.any().describe('Content data: could be markdown, table, or mixed JSON'),
  citations: z.any().optional().describe('Optional citations or references'),
  metadata: z.any().optional().describe('Optional metadata such as difficulty, tags, etc.'),

  createdAt: z.date().describe('Timestamp when the content was created'),
  updatedAt: z.date().describe('Timestamp when the content was last updated'),
});

// =====================================================================
// 2. Content Detail Schema
// =====================================================================
export const ContentDetailSchema = extendApi(
  BaseContentSchema,
  {
    title: 'ContentDetail',
    example: {
      id: 'content-uuid-123',
      stepId: 'step-uuid-456',
      data: "# Pendahuluan\nIni adalah materi pendahuluan dalam format markdown.",
      citations: ['Buku Pemrograman Dasar Hal. 12'],
      metadata: { difficulty: 'beginner' },
      createdAt: '2025-08-17T10:00:00Z',
      updatedAt: '2025-08-17T10:05:00Z',
    }
  }
);

// =====================================================================
// 3. Content List Schema (with pagination)
// =====================================================================
export const ContentListSchema = extendApi(
  z.object({
    data: z.array(BaseContentSchema).describe('List of contents'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of contents'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Whether there is a next page'),
      hasPrev: z.boolean().describe('Whether there is a previous page'),
    }).describe('Pagination details'),
  }),
  {
    title: 'ContentList',
    example: {
      data: [
        {
          id: 'content-uuid-123',
          stepId: 'step-uuid-456',
          type: 'MARKDOWN',
          data: '# Materi Pendahuluan\nIni adalah konten markdown.',
          citations: ['https://example.com/referensi'],
          metadata: { difficulty: 'easy' },
          createdAt: '2025-08-17T09:00:00Z',
          updatedAt: '2025-08-17T09:30:00Z',
        },
        {
          id: 'content-uuid-124',
          stepId: 'step-uuid-456',
          type: 'TABLE',
          data: {
            headers: ['Nama', 'Nilai'],
            rows: [['Ali', 90], ['Budi', 85]]
          },
          createdAt: '2025-08-17T09:10:00Z',
          updatedAt: '2025-08-17T09:40:00Z',
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }
    }
  }
);
