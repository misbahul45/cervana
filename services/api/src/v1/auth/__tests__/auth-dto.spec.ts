import { ForgotPasswordDto, LoginDto, OtpTypeQueryDto, RegisterDto, ResetPasswordDto, VerificationDto } from '@/v1/auth/auth.dto';

const register = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ayu',
  email: 'ayu@example.test',
  password: 'long-enough-1',
  confirmPassword: 'long-enough-1',
  ...overrides,
});

describe('RegisterDto', () => {
  it('trims and lower-cases the email and trims the name', () => {
    const parsed = RegisterDto.parse(register({ name: '  Ayu  ', email: '  Ayu@Example.TEST ' }));

    expect(parsed.email).toBe('ayu@example.test');
    expect(parsed.name).toBe('Ayu');
  });

  it('wants at least eight characters, the same floor the reset form already had', () => {
    expect(RegisterDto.safeParse(register({ password: 'short12', confirmPassword: 'short12' })).success).toBe(false);
    expect(RegisterDto.safeParse(register({ password: 'exactly8', confirmPassword: 'exactly8' })).success).toBe(true);
  });

  it('refuses a password bcrypt would silently cut at 72 bytes', () => {
    const long = 'a'.repeat(73);

    expect(RegisterDto.safeParse(register({ password: long, confirmPassword: long })).success).toBe(false);
    expect(RegisterDto.safeParse(register({ password: 'a'.repeat(72), confirmPassword: 'a'.repeat(72) })).success).toBe(true);
  });

  it('refuses a confirmation that does not match and a blank name', () => {
    expect(RegisterDto.safeParse(register({ confirmPassword: 'different-1' })).success).toBe(false);
    expect(RegisterDto.safeParse(register({ name: '   ' })).success).toBe(false);
  });
});

describe('LoginDto', () => {
  it('accepts a legacy short password so an old account is not locked out by a newer policy', () => {
    expect(LoginDto.safeParse({ email: 'ayu@example.test', password: '123456' }).success).toBe(true);
    expect(LoginDto.safeParse({ email: 'ayu@example.test', password: '' }).success).toBe(false);
  });

  it('normalises the email and caps the password length', () => {
    expect(LoginDto.parse({ email: ' AYU@example.test ', password: 'x' }).email).toBe('ayu@example.test');
    expect(LoginDto.safeParse({ email: 'ayu@example.test', password: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('one-time codes', () => {
  it('wants exactly six digits for verification and for reset', () => {
    expect(VerificationDto.safeParse({ identifier: 'ayu@example.test', otp: '123456' }).success).toBe(true);
    for (const otp of ['12345', '1234567', 'abcdef', '12 456', '']) {
      expect(VerificationDto.safeParse({ identifier: 'ayu@example.test', otp }).success).toBe(false);
    }
    const reset = { identifier: 'ayu@example.test', newPassword: 'brand-new-1', confirmPassword: 'brand-new-1' };
    expect(ResetPasswordDto.safeParse({ ...reset, otp: '000123' }).success).toBe(true);
    expect(ResetPasswordDto.safeParse({ ...reset, otp: '12345678' }).success).toBe(false);
  });

  it('normalises the identifier email', () => {
    expect(VerificationDto.parse({ identifier: ' AYU@example.test', otp: '123456' }).identifier).toBe('ayu@example.test');
  });

  it('holds a reset password to the same length bounds as registration', () => {
    const base = { identifier: 'ayu@example.test', otp: '123456' };

    expect(ResetPasswordDto.safeParse({ ...base, newPassword: 'short12', confirmPassword: 'short12' }).success).toBe(false);
    expect(ResetPasswordDto.safeParse({ ...base, newPassword: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) }).success).toBe(false);
    expect(ResetPasswordDto.safeParse({ ...base, newPassword: 'abcdefgh', confirmPassword: 'abcdefgi' }).success).toBe(false);
  });
});

describe('ForgotPasswordDto', () => {
  it('normalises the email', () => {
    expect(ForgotPasswordDto.parse({ email: ' Ayu@Example.test ' }).email).toBe('ayu@example.test');
  });
});

describe('OtpTypeQueryDto', () => {
  it('knows the two code kinds and defaults to email verification', () => {
    expect(OtpTypeQueryDto.parse({ type: 'pw' }).type).toBe('pw');
    expect(OtpTypeQueryDto.parse({ type: 'email' }).type).toBe('email');
    expect(OtpTypeQueryDto.parse({}).type).toBe('email');
  });

  it('rejects anything else instead of quietly treating it as email verification', () => {
    expect(OtpTypeQueryDto.safeParse({ type: 'admin' }).success).toBe(false);
  });
});
