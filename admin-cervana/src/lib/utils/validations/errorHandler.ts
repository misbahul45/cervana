import type { HandleValidationError } from "@sveltejs/kit";
import { ZodError } from "zod";


export interface ValidationErrorResult {
  errors: Record<string, string[]>;
  values?: Record<string, unknown>;
  message?: string;
}

export function handleZodError<T extends Record<string, unknown>>(
  error: unknown,
  values?: T
): ValidationErrorResult {
  if (error instanceof ZodError) {
    return {
      errors: error.flatten().fieldErrors,
      values,
      message: "Validation failed",
    };
  }

  return {
    errors: { global: ["Unexpected server error occurred"] },
    values,
    message: "Internal Server Error",
  };
}
