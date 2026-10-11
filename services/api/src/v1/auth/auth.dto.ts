import { z } from "zod";
import { extendApi } from '@anatine/zod-openapi';

const emailField = z.string().trim().toLowerCase().email("Invalid email address");

const newPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const codeField = z.string().regex(/^\d{6}$/, "Code must be 6 digits");

export const RegisterDto = extendApi(
  z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long").describe("Full name of the user"),
    email: emailField.describe("Valid email address"),
    password: newPasswordField.describe("Password (8 to 72 characters)"),
    confirmPassword: z.string().describe("Password confirmation"),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
  {
    title: 'RegisterRequest',
    example: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    }
  }
);

export const LoginDto = extendApi(
  z.object({
    email: emailField.describe("User email address"),
    password: z.string().min(1, "Password is required").max(128, "Password is too long").describe("User password"),
  }),
  {
    title: 'LoginRequest',
    example: {
      email: 'john@example.com',
      password: 'password123'
    }
  }
);

export const VerificationDto = extendApi(
  z.object({
    identifier: emailField.describe("Email address the code was sent to"),
    otp: codeField.describe("6-digit code"),
  }),
  {
    title: 'VerificationRequest',
    example: {
      identifier: 'john@example.com',
      otp: '123456'
    }
  }
);

export const ResetPasswordDto = extendApi(
  z.object({
    identifier: emailField.describe("Email address the code was sent to"),
    otp: codeField.describe("6-digit code"),
    newPassword: newPasswordField.describe("New password (8 to 72 characters)"),
    confirmPassword: z.string().describe("Confirm new password"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
  {
    title: 'ResetPasswordRequest',
    example: {
      identifier: 'john@example.com',
      otp: '123456',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123'
    }
  }
);

export const ForgotPasswordDto = extendApi(
  z.object({
    email: emailField.describe("Email address to send the code to")
  }),
  {
    title: 'ForgotPasswordRequest',
    example: {
      email: 'john@example.com'
    }
  }
);

export const OtpTypeQueryDto = z.object({
  type: z.enum(['email', 'pw']).default('email'),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type VerificationDtoType = z.infer<typeof VerificationDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type OtpTypeQueryDtoType = z.infer<typeof OtpTypeQueryDto>;
