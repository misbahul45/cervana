import { Type } from '@nestjs/common';
import { ZodSchema } from 'zod';

export interface ApiResponseOptions {
  summary: string;
  description?: string;
  dataSchema?: ZodSchema;
  isPublic?: boolean;
  tags?: string[];
}

export interface ApiOperationOptions extends ApiResponseOptions {
  body?: ZodSchema;
  params?: Array<{ name: string; description?: string; example?: any; schema?: ZodSchema }>;
  queries?: Array<{ name: string; description?: string; required?: boolean; example?: any; schema?: ZodSchema }>;
}

export interface ApiParamOption {
  name: string;
  description?: string;
  example?: any;
  schema?: ZodSchema;
}

export interface ApiQueryOption {
  name: string;
  description?: string;
  required?: boolean;
  example?: any;
  schema?: ZodSchema;
}