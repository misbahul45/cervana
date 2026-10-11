import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, { message: "Nama harus diisi" }).max(100, { message: "Nama terlalu panjang" }),
  email: z.string().email({ message: "Email tidak valid" }),
  password: z
    .string()
    .min(8, { message: "Kata sandi minimal 8 karakter" })
    .max(72, { message: "Kata sandi maksimal 72 karakter" }),
  confirmPassword: z.string().min(1, { message: "Konfirmasi kata sandi harus diisi" }),
  agree: z.boolean().refine((val) => val === true, { message: "Centang persetujuan untuk melanjutkan" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Kata sandi dan konfirmasi tidak cocok",
  path: ["confirmPassword"],

});

export const LoginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Kata sandi harus diisi" }),
});

const otpField = z.string().regex(/^\d{6}$/, { message: "Kode terdiri dari 6 angka" });

export const VerificationSchema = z.object({
  identifier: z.string().email({ message: "Email tidak valid" }),
  otp: otpField,
});

export const ResetPasswordSchema = z.object({
  identifier: z.string().email({ message: "Email tidak valid" }),
  otp: otpField,
  newPassword: z
    .string()
    .min(8, { message: "Kata sandi baru minimal 8 karakter" })
    .max(72, { message: "Kata sandi baru maksimal 72 karakter" }),
  confirmPassword: z.string().min(1, { message: "Konfirmasi kata sandi harus diisi" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Kata sandi baru dan konfirmasi tidak cocok",
  path: ["confirmPassword"],
});


export const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
});

export type RegisterSchemaType = z.infer<typeof RegisterSchema>;
export type LoginSchemaType = z.infer<typeof LoginSchema>;
export type VerificationSchemaType = z.infer<typeof VerificationSchema>;
export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>;
export type ForgotPasswordSchemaType = z.infer<typeof ForgotPasswordSchema>;