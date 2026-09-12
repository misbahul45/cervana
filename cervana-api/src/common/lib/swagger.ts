import { extendApi } from "@anatine/zod-openapi";
import z, { ZodSchema } from "zod";
import { ZodObject, ZodRawShape } from 'zod';

export const createApiResponseSchema = <T extends ZodSchema>(dataSchema: T, title?: string) => {
  return extendApi(
    z.object({
      success: z.literal(true),
      message: z.string(),
      data: dataSchema,
      meta: z.object({
        requestId: z.string(),
        timestamp: z.string(),
        statusCode: z.number(),
      }),
    }),
    {
      title: title ? `${title}ApiResponse` : 'ApiResponse'
    }
  );
};


export const createErrorResponseSchema = (title?: string) => {
  return extendApi(
    z.object({
      success: z.literal(false),
      message: z.string(),
      error: z.any(),
      data: z.null(),
      meta: z.object({
        requestId: z.string(),
        timestamp: z.string(),
        statusCode: z.number(),
      }),
    }),
    {
      title: title ? `${title}ErrorResponse` : 'ErrorResponse'
    }
  );
};


// Common query builders
export const COMMON_QUERY_SCHEMAS = {
  PAGINATION: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
  SEARCH: z.object({
    search: z.string().optional(),
  }),
  SORT: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
  DATE_RANGE: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
  STATUS_FILTER: z.object({
    status: z.string().optional(),
  }),
};

// Combine query schemas 
export const combineQuerySchemas = (...schemas: ZodObject<ZodRawShape>[]) => {
  return schemas.reduce((acc, schema) => acc.merge(schema), z.object({}));
};

// Utility untuk membuat list response schema
export const createListResponseSchema = <T extends ZodSchema>(itemSchema: T, title?: string) => {
  return extendApi(
    z.object({
      items: z.array(itemSchema),
      total: z.number().int().nonnegative(),
    }),
    {
      title: title ? `${title}ListResponse` : 'ListResponse'
    }
  );
};