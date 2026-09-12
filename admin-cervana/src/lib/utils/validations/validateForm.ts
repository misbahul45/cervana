import { fail } from "@sveltejs/kit";
import { handleZodError } from "./errorHandler";
import type { ZodTypeAny } from "zod";


export async function validateForm<T extends ZodTypeAny>(
  schema: T,
  data: Record<string, unknown>
) {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    throw new Error("ValidationError", { cause: error });
  }
}
