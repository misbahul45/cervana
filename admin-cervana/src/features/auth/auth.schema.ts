import z from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Masukkan email yang valid"),
  password: z.string().min(6, "Minimal 6 karakter"),
});

export type LoginSchemaType = z.infer<typeof LoginSchema>;