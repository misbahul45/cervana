import { ApiResponse } from "../interfaces";
import { ZodSchema } from 'zod'

export async function errorHandler<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw error;
  }
}

export const createApiResponse = <T>(
  message: string,
  data: T,
): Omit<ApiResponse<T>, 'meta'> => ({
  success: true,
  message,
  data,
});

export function validation<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw result.error
  }

  return result.data
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const cleanCreateData = (data: any) => {
  const {
    id,
    createdAt,
    updatedAt,
    chat,
    user,
    quiz,
    stepTemplate,
    ...rest
  } = data;

  return rest;
};
