jest.mock('@/common/lib/email', () => ({
  sendOTPVerificationEmail: jest.fn().mockResolvedValue({}),
}));

import * as bcrypt from 'bcrypt';
import { AuthProvider, VerificationType } from '@prisma/client';
import { AppErrorCode } from '@/common/lib/error';
import { sendOTPVerificationEmail } from '@/common/lib/email';
import { AuthService, BCRYPT_ROUNDS, DUMMY_PASSWORD_HASH } from '@/v1/auth/auth.service';

const GENERIC_LOGIN_ERROR = { message: 'Invalid email or password', statusCode: 400, code: AppErrorCode.VALIDATION_ERROR };
const INVALID_CODE_ERROR = { message: 'Invalid or expired code', statusCode: 400, code: AppErrorCode.INVALID_OTP };

const hash = (plain: string) => bcrypt.hashSync(plain, 4);

const makeUsers = () => {
  const rows: any[] = [];
  return {
    rows,
    findOne: jest.fn(async (key: string, value: unknown) => rows.find((r) => r[key] === value) ?? null),
    create: jest.fn(async (values: any) => {
      const row = { id: `u-${rows.length + 1}`, role: 'STUDENT', isActive: true, emailVerified: null, password: null, ...values };
      rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ id, values }: { id?: string; values: any }) => {
      const row = rows.find((r) => r.id === id);
      Object.assign(row, values);
      return row;
    }),
    findActiveMembershipRoles: jest.fn().mockResolvedValue([]),
  };
};

const build = () => {
  const users = makeUsers();
  const otp = {
    issue: jest.fn(async () => '123456'),
    consume: jest.fn(async (_identifier: string, _type: VerificationType, code: string) => code === '123456'),
  };
  const sessions = {
    createSession: jest.fn().mockResolvedValue({}),
    findSessionByToken: jest.fn(),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt'), verifyAsync: jest.fn() };
  const config = { get: jest.fn((key: string) => (key.startsWith('JWT_') && key.endsWith('SECRET') ? 'secret-for-tests' : undefined)) };
  const service = new AuthService(jwt as any, config as any, sessions as any, users as any, otp as any);
  return { service, users, otp, sessions, jwt };
};

const seedUser = (users: ReturnType<typeof makeUsers>, overrides: Record<string, unknown> = {}) => {
  const row = {
    id: `u-${users.rows.length + 1}`,
    name: 'Ayu',
    email: 'ayu@example.test',
    password: hash('correct-horse'),
    role: 'STUDENT',
    isActive: true,
    emailVerified: new Date('2026-01-01'),
    provider: AuthProvider.JWT,
    ...overrides,
  };
  users.rows.push(row);
  return row;
};

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('constants', () => {
  it('hashes passwords with cost 12 and keeps a dummy hash of the same cost to equalise timing', () => {
    expect(BCRYPT_ROUNDS).toBe(12);
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(12);
  });
});

describe('AuthService.login', () => {
  it('answers an unknown email exactly like a wrong password, and still spends a password comparison', async () => {
    const { service, users } = build();
    seedUser(users);
    const compare = jest.spyOn(bcrypt, 'compare');

    await expect(service.login({ email: 'ghost@example.test', password: 'whatever-1' })).rejects.toMatchObject(GENERIC_LOGIN_ERROR);
    expect(compare).toHaveBeenCalledWith('whatever-1', DUMMY_PASSWORD_HASH);

    await expect(service.login({ email: 'ayu@example.test', password: 'wrong-password' })).rejects.toMatchObject(GENERIC_LOGIN_ERROR);
  });

  it('answers an account that has no password at all like a wrong password', async () => {
    const { service, users } = build();
    seedUser(users, { password: null, provider: AuthProvider.Google });

    await expect(service.login({ email: 'ayu@example.test', password: 'anything-1' })).rejects.toMatchObject(GENERIC_LOGIN_ERROR);
  });

  it('only says the email is unverified after the password was right, so a stranger cannot probe for pending accounts', async () => {
    const { service, users } = build();
    seedUser(users, { emailVerified: null });

    await expect(service.login({ email: 'ayu@example.test', password: 'wrong-password' })).rejects.toMatchObject(GENERIC_LOGIN_ERROR);
    await expect(service.login({ email: 'ayu@example.test', password: 'correct-horse' })).rejects.toMatchObject({ message: 'Unverified email' });
  });

  it('refuses a deactivated account with the same generic answer', async () => {
    const { service, users } = build();
    seedUser(users, { isActive: false });

    await expect(service.login({ email: 'ayu@example.test', password: 'correct-horse' })).rejects.toMatchObject(GENERIC_LOGIN_ERROR);
  });

  it('logs in with the right password regardless of the case and spacing typed in the email', async () => {
    const { service, users } = build();
    const row = seedUser(users);

    const result = await service.login({ email: '  Ayu@Example.TEST ', password: 'correct-horse' });

    expect(result).toEqual({ sub: row.id, email: row.email, role: 'STUDENT' });
  });
});

describe('AuthService.register', () => {
  it('creates a lower-cased account with a cost-12 hash and sends a verification code', async () => {
    const { service, users, otp } = build();

    const result = await service.register({ name: 'Budi', email: 'Budi@Example.test', password: 'long-enough-1', confirmPassword: 'long-enough-1' });

    const created = users.rows[0];
    expect(created.email).toBe('budi@example.test');
    expect(bcrypt.getRounds(created.password)).toBe(12);
    expect(created.password).not.toBe('long-enough-1');
    expect(otp.issue).toHaveBeenCalledWith('budi@example.test', VerificationType.EMAIL_VERIFICATION);
    expect(sendOTPVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'budi@example.test', token: '123456' }));
    expect(result.data).toEqual({ id: created.id, email: 'budi@example.test' });
  });

  it('refuses an email that already belongs to a verified account, without sending any code', async () => {
    const { service, users, otp } = build();
    seedUser(users);

    await expect(
      service.register({ name: 'Imposter', email: 'ayu@example.test', password: 'long-enough-1', confirmPassword: 'long-enough-1' }),
    ).rejects.toMatchObject({ statusCode: 400, code: AppErrorCode.EMAIL_ALREADY_REGISTERED });
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('lets the real owner take over an account that was registered but never verified, replacing the old password', async () => {
    const { service, users, otp } = build();
    const squatted = seedUser(users, { emailVerified: null, password: hash('attacker-chosen'), name: 'Squatter' });

    const result = await service.register({ name: 'Ayu Asli', email: 'ayu@example.test', password: 'owner-password-1', confirmPassword: 'owner-password-1' });

    expect(users.rows).toHaveLength(1);
    expect(squatted.name).toBe('Ayu Asli');
    expect(await bcrypt.compare('owner-password-1', squatted.password)).toBe(true);
    expect(await bcrypt.compare('attacker-chosen', squatted.password)).toBe(false);
    expect(otp.issue).toHaveBeenCalledWith('ayu@example.test', VerificationType.EMAIL_VERIFICATION);
    expect(result.data.email).toBe('ayu@example.test');
  });
});

describe('AuthService.verifyOTP', () => {
  it('marks the account verified by id when the code is right', async () => {
    const { service, users, otp } = build();
    const row = seedUser(users, { emailVerified: null });

    await service.verifyOTP({ identifier: 'Ayu@example.test', otp: '123456' });

    expect(otp.consume).toHaveBeenCalledWith('ayu@example.test', VerificationType.EMAIL_VERIFICATION, '123456');
    expect(row.emailVerified).toBeInstanceOf(Date);
    expect(users.update).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }));
  });

  it('rejects a wrong code with one generic answer, whether or not the account exists or is already verified', async () => {
    const { service, users } = build();
    seedUser(users);

    await expect(service.verifyOTP({ identifier: 'ayu@example.test', otp: '000000' })).rejects.toMatchObject(INVALID_CODE_ERROR);
    await expect(service.verifyOTP({ identifier: 'ghost@example.test', otp: '000000' })).rejects.toMatchObject(INVALID_CODE_ERROR);
  });

  it('does not touch any account when the code is right but the account is gone', async () => {
    const { service, users } = build();

    await expect(service.verifyOTP({ identifier: 'ghost@example.test', otp: '123456' })).rejects.toMatchObject(INVALID_CODE_ERROR);
    expect(users.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.requestPasswordReset', () => {
  it('stays silent for an email nobody registered: nothing is issued, nothing is sent, nothing is thrown', async () => {
    const { service, otp } = build();

    await expect(service.requestPasswordReset('ghost@example.test')).resolves.toBeUndefined();
    await flush();

    expect(otp.issue).not.toHaveBeenCalled();
    expect(sendOTPVerificationEmail).not.toHaveBeenCalled();
  });

  it('issues a password reset code for a known account, including one that has no password yet', async () => {
    const { service, users, otp } = build();
    seedUser(users, { password: null, provider: AuthProvider.Google });

    await service.requestPasswordReset('AYU@example.test');
    await flush();

    expect(otp.issue).toHaveBeenCalledWith('ayu@example.test', VerificationType.PASSWORD_RESET);
    expect(sendOTPVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ayu@example.test', token: '123456' }));
  });

  it('answers as fast as for an unknown email: delivery never blocks the response', async () => {
    const { service, users, otp } = build();
    seedUser(users);
    let release: (value: string) => void = () => undefined;
    otp.issue.mockImplementation(() => new Promise<string>((resolve) => { release = resolve; }));

    const outcome = await Promise.race([
      service.requestPasswordReset('ayu@example.test').then(() => 'answered'),
      new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 200)),
    ]);

    expect(outcome).toBe('answered');
    release('123456');
    await flush();
  });

  it('does not email a deactivated account', async () => {
    const { service, users, otp } = build();
    seedUser(users, { isActive: false });

    await service.requestPasswordReset('ayu@example.test');
    await flush();

    expect(otp.issue).not.toHaveBeenCalled();
  });
});

describe('AuthService.resendOtp', () => {
  it('resends a verification code to an unverified account', async () => {
    const { service, users, otp } = build();
    seedUser(users, { emailVerified: null });

    await service.resendOtp('ayu@example.test', 'email');
    await flush();

    expect(otp.issue).toHaveBeenCalledWith('ayu@example.test', VerificationType.EMAIL_VERIFICATION);
  });

  it('does nothing, silently, for an unknown email or an account that is already verified', async () => {
    const { service, users, otp } = build();
    seedUser(users);

    await expect(service.resendOtp('ghost@example.test', 'email')).resolves.toBeUndefined();
    await expect(service.resendOtp('ayu@example.test', 'email')).resolves.toBeUndefined();
    await flush();

    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('routes the pw type to a password reset code', async () => {
    const { service, users, otp } = build();
    seedUser(users);

    await service.resendOtp('ayu@example.test', 'pw');
    await flush();

    expect(otp.issue).toHaveBeenCalledWith('ayu@example.test', VerificationType.PASSWORD_RESET);
  });
});

describe('AuthService.resetPassword', () => {
  const dto = { identifier: 'ayu@example.test', otp: '123456', newPassword: 'brand-new-pass-1', confirmPassword: 'brand-new-pass-1' };

  it('sets a cost-12 hash, proves the mailbox, and signs every device out', async () => {
    const { service, users, sessions, otp } = build();
    const row = seedUser(users, { emailVerified: null, password: hash('old-password') });

    await service.resetPassword(dto);

    expect(otp.consume).toHaveBeenCalledWith('ayu@example.test', VerificationType.PASSWORD_RESET, '123456');
    expect(bcrypt.getRounds(row.password)).toBe(12);
    expect(await bcrypt.compare('brand-new-pass-1', row.password)).toBe(true);
    expect(row.emailVerified).toBeInstanceOf(Date);
    expect(sessions.revokeAllUserSessions).toHaveBeenCalledWith(row.id);
  });

  it('keeps an existing verification date instead of overwriting it', async () => {
    const { service, users } = build();
    const row = seedUser(users);
    const verifiedAt = row.emailVerified;

    await service.resetPassword(dto);

    expect(row.emailVerified).toBe(verifiedAt);
  });

  it('changes nothing and signs nobody out when the code is wrong', async () => {
    const { service, users, sessions } = build();
    const row = seedUser(users, { password: hash('old-password') });
    const before = row.password;

    await expect(service.resetPassword({ ...dto, otp: '000000' })).rejects.toMatchObject(INVALID_CODE_ERROR);

    expect(row.password).toBe(before);
    expect(sessions.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('answers a right code for an account that no longer exists like any invalid code', async () => {
    const { service } = build();

    await expect(service.resetPassword({ ...dto, identifier: 'ghost@example.test' })).rejects.toMatchObject(INVALID_CODE_ERROR);
  });
});

describe('AuthService.revokeSessionOf', () => {
  it('deletes the session carried by a valid access token', async () => {
    const { service, jwt, sessions } = build();
    jwt.verifyAsync.mockResolvedValue({ sub: 'u-1', sessionToken: 'session-1' });

    await service.revokeSessionOf('access.jwt');

    expect(sessions.deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('does nothing, and does not throw, for a missing or unverifiable token', async () => {
    const { service, jwt, sessions } = build();
    jwt.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    await expect(service.revokeSessionOf(undefined)).resolves.toBeUndefined();
    await expect(service.revokeSessionOf('garbage')).resolves.toBeUndefined();

    expect(sessions.deleteSession).not.toHaveBeenCalled();
  });
});
