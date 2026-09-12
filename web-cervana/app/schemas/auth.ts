import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(1, { message: "Nama harus diisi" }),
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(8, { message: "Password minimal 8 karakter" }),
  confirmPassword: z.string().min(8, { message: "Konfirmasi password minimal 8 karakter" }),
  agree:z.boolean().refine((val) => val === true, { message: "Anda harus menyetujui syarat dan ketentuan" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password dan konfirmasi password tidak cocok",
  path: ["confirmPassword"],

});

export const LoginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(8, { message: "Password minimal 8 karakter" }),
  rememberMe:z.boolean()
});

export const VerificationSchema = z.object({
  identifier: z.string().email('Invalid email').min(1, { message: "Email atau ID harus diisi" }),
  otp: z.string().min(1, { message: "OTP harus diisi" }).length(6, { message: "OTP harus terdiri dari 6 karakter" }),
});

export const ResetPasswordSchema = z.object({
  identifier: z.string().min(1, { message: "Email atau ID harus diisi" }),
  otp: z.string().min(1, { message: "OTP harus diisi" }).length(6, { message: "OTP harus terdiri dari 6 karakter" }),
  newPassword: z.string().min(8, { message: "Password baru minimal 8 karakter" }),
  confirmPassword: z.string().min(8, { message: "Konfirmasi password minimal 8 karakter" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password baru dan konfirmasi tidak cocok",
  path: ["confirmPassword"],
});


export const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
});

// Type inference
export type RegisterSchemaType = z.infer<typeof RegisterSchema>;
export type LoginSchemaType = z.infer<typeof LoginSchema>;
export type VerificationSchemaType = z.infer<typeof VerificationSchema>;
export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>;
export type ForgotPasswordSchemaType = z.infer<typeof ForgotPasswordSchema>;