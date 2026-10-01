import { z } from "zod";
import { extendApi } from '@anatine/zod-openapi';
import { VerificationType } from "@prisma/client";

export const RegisterDto = extendApi(
  z.object({
    name: z.string().min(1, "Name is required").describe("Full name of the user"),
    email: z.string().email("Invalid email address").describe("Valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").describe("Password (min 6 characters)"),
    confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters").describe("Password confirmation"),
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
    email: z.string().email("Invalid email address").describe("User email address"),
    password: z.string().min(6, "Password must be at least 6 characters").describe("User password"),
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
    identifier: z.string().min(1, "Identifier is required").describe("Email address or user identifier"),
    otp: z.string().min(6, "OTP must be at least 6 characters").max(6, "OTP must be at most 6 characters").describe("6-digit OTP code"),
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
    identifier: z.string().min(1).describe("Email address or user identifier"),
    otp: z.string().min(4).max(10).describe("OTP code for verification"),
    newPassword: z.string().min(8).describe("New password"),
    confirmPassword: z.string().min(8).describe("Confirm new password"),
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
    email: z.string().email('Invalid email').describe("Email address to send reset code")
  }),
  {
    title: 'ForgotPasswordRequest',
    example: {
      email: 'john@example.com'
    }
  }
);


export const CreateVerificationTokenDto = z.object({
  identifier: z.string().min(1).email(),
  otp: z.string().min(4).max(10),
  type: z.nativeEnum(VerificationType),
  expires: z.date(),
})
export type CreateVerificationTokenDtoType = z.infer<typeof CreateVerificationTokenDto>

export const UpdateVerificationTokenDto = z.object({
  otp: z.string().optional(),
  type: z.nativeEnum(VerificationType).optional(),
  expires: z.date().optional(),
})
export type UpdateVerificationTokenDtoType = z.infer<typeof UpdateVerificationTokenDto>

export const FindVerificationTokenDto = z.object({
  identifier: z.string().min(1),
  otp: z.string().min(1),
})
export type FindVerificationTokenDtoType = z.infer<typeof FindVerificationTokenDto>

export const CreateSessionDto = z.object({
  sessionToken: z.string().min(1),
  userId: z.number().int(),
  expires: z.date(),
})
export type CreateSessionDtoType = z.infer<typeof CreateSessionDto>

export const UpdateSessionDto = z.object({
  sessionToken: z.string().optional(),
  userId: z.number().int().optional(),
  expires: z.date().optional(),
})
export type UpdateSessionDtoType = z.infer<typeof UpdateSessionDto>

export const FindSessionDto = z.object({
  sessionToken: z.string().min(1),
})
export type FindSessionDtoType = z.infer<typeof FindSessionDto>


// Type exports
export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type VerificationDtoType = z.infer<typeof VerificationDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;