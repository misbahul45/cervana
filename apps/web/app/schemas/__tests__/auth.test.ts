import { describe, expect, it } from 'vitest';
import { ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, VerificationSchema } from '~/schemas';

const register = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ayu',
  email: 'ayu@example.test',
  password: 'long-enough-1',
  confirmPassword: 'long-enough-1',
  agree: true,
  ...overrides,
});

describe('LoginSchema', () => {
  it('lets a legacy short password through, so the server decides, and has no remember-me flag', () => {
    expect(LoginSchema.safeParse({ email: 'ayu@example.test', password: '123456' }).success).toBe(true);
    expect(LoginSchema.safeParse({ email: 'ayu@example.test', password: '' }).success).toBe(false);
    expect(Object.keys(LoginSchema.shape)).toEqual(['email', 'password']);
  });
});

describe('RegisterSchema', () => {
  it('matches the server: eight to seventy-two characters', () => {
    expect(RegisterSchema.safeParse(register({ password: 'short12', confirmPassword: 'short12' })).success).toBe(false);
    expect(RegisterSchema.safeParse(register({ password: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) })).success).toBe(false);
    expect(RegisterSchema.safeParse(register()).success).toBe(true);
  });

  it('wants the consent box ticked and the passwords to match', () => {
    expect(RegisterSchema.safeParse(register({ agree: false })).success).toBe(false);
    expect(RegisterSchema.safeParse(register({ confirmPassword: 'different-1' })).success).toBe(false);
  });
});

describe('codes', () => {
  it('wants exactly six digits for verification and reset', () => {
    expect(VerificationSchema.safeParse({ identifier: 'ayu@example.test', otp: '123456' }).success).toBe(true);
    for (const otp of ['12345', '1234567', 'abcdef', '']) {
      expect(VerificationSchema.safeParse({ identifier: 'ayu@example.test', otp }).success).toBe(false);
    }
    const reset = { identifier: 'ayu@example.test', newPassword: 'brand-new-1', confirmPassword: 'brand-new-1' };
    expect(ResetPasswordSchema.safeParse({ ...reset, otp: '000123' }).success).toBe(true);
    expect(ResetPasswordSchema.safeParse({ ...reset, otp: '12ab56' }).success).toBe(false);
  });

  it('holds a new password to the same bounds as registration', () => {
    const base = { identifier: 'ayu@example.test', otp: '123456' };

    expect(ResetPasswordSchema.safeParse({ ...base, newPassword: 'short12', confirmPassword: 'short12' }).success).toBe(false);
    expect(ResetPasswordSchema.safeParse({ ...base, newPassword: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) }).success).toBe(false);
  });
});

describe('ForgotPasswordSchema', () => {
  it('wants a valid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'ayu@example.test' }).success).toBe(true);
    expect(ForgotPasswordSchema.safeParse({ email: 'ayu' }).success).toBe(false);
  });
});
