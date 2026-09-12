import { fail } from "@sveltejs/kit";
import { handleZodError } from "./errorHandler";
export async function withTryCatch<T>(
  fn: () => Promise<T> | T,
  context?: Record<string, unknown>
) {
  try {
    const result = await fn();
    return result
  } catch (error) {
    console.error("❌ Server error caught:", error);
    return fail(400, handleZodError(error, context));
  }
}
