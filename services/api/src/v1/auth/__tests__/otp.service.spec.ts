import { VerificationType } from '@prisma/client';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, OtpService, generateCode, hashCode } from '@/v1/auth/otp.service';

interface StoredToken {
  id: string;
  identifier: string;
  type: VerificationType;
  otp: string;
  attempts: number;
  expires: Date;
}

class InMemoryTokens {
  rows: StoredToken[] = [];
  private seq = 0;

  async upsert(values: { identifier: string; type: VerificationType; otp: string; expires: Date }) {
    const existing = this.rows.find((r) => r.identifier === values.identifier && r.type === values.type);
    if (existing) {
      Object.assign(existing, { otp: values.otp, expires: values.expires, attempts: 0 });
      return existing;
    }
    const row = { id: `t-${(this.seq += 1)}`, attempts: 0, ...values };
    this.rows.push(row);
    return row;
  }

  async find(identifier: string, type: VerificationType) {
    return this.rows.find((r) => r.identifier === identifier && r.type === type) ?? null;
  }

  async registerFailure(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    row.attempts += 1;
    return row;
  }

  async deleteById(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return before - this.rows.length;
  }
}

const EMAIL = 'learner@example.test';

const build = () => {
  const tokens = new InMemoryTokens();
  const config = { get: jest.fn((key: string) => (key === 'JWT_REFRESH_SECRET' ? 'a-long-refresh-secret-for-tests-0123456789' : undefined)) };
  const service = new OtpService(config as any, tokens as any);
  return { service, tokens };
};

describe('generateCode', () => {
  it('is always six digits, including codes with leading zeros', () => {
    expect(generateCode(() => 0)).toBe('000000');
    expect(generateCode(() => 42)).toBe('000042');
    expect(generateCode(() => 999_999)).toBe('999999');
  });

  it('draws from the whole range of a six digit code', () => {
    const random = jest.fn(() => 7);
    generateCode(random);
    expect(random).toHaveBeenCalledWith(0, 1_000_000);
  });
});

describe('hashCode', () => {
  it('is bound to the secret, the identifier, the type and the code', () => {
    const base = hashCode('s', EMAIL, VerificationType.PASSWORD_RESET, '123456');
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode('s', EMAIL, VerificationType.PASSWORD_RESET, '123456')).toBe(base);
    expect(hashCode('other', EMAIL, VerificationType.PASSWORD_RESET, '123456')).not.toBe(base);
    expect(hashCode('s', 'x@example.test', VerificationType.PASSWORD_RESET, '123456')).not.toBe(base);
    expect(hashCode('s', EMAIL, VerificationType.EMAIL_VERIFICATION, '123456')).not.toBe(base);
    expect(hashCode('s', EMAIL, VerificationType.PASSWORD_RESET, '123457')).not.toBe(base);
  });
});

describe('OtpService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses to start without any secret to hash with', () => {
    const config = { get: jest.fn(() => undefined) };

    expect(() => new OtpService(config as any, new InMemoryTokens() as any)).toThrow(/secret/i);
  });

  it('issues a six digit code and stores only its hash, never the code', async () => {
    const { service, tokens } = build();

    const code = await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);

    expect(code).toMatch(/^\d{6}$/);
    expect(tokens.rows).toHaveLength(1);
    expect(tokens.rows[0].otp).not.toBe(code);
    expect(tokens.rows[0].otp).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.rows[0].expires.getTime()).toBe(Date.now() + OTP_TTL_MS);
  });

  it('lives for fifteen minutes, not a day', () => {
    expect(OTP_TTL_MS).toBe(15 * 60 * 1000);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });

  it('accepts the right code once and then burns it', async () => {
    const { service, tokens } = build();
    const code = await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);

    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, code)).toBe(true);
    expect(tokens.rows).toHaveLength(0);
    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, code)).toBe(false);
  });

  it('lets exactly one of two simultaneous submissions of the right code through', async () => {
    const { service } = build();
    const code = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);

    const results = await Promise.all([
      service.consume(EMAIL, VerificationType.PASSWORD_RESET, code),
      service.consume(EMAIL, VerificationType.PASSWORD_RESET, code),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('counts wrong guesses and destroys the token on the fifth, even for the right code afterwards', async () => {
    const { service, tokens } = build();
    const code = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);
    const wrong = code === '000000' ? '000001' : '000000';

    for (let attempt = 1; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, wrong)).toBe(false);
      expect(tokens.rows[0].attempts).toBe(attempt);
    }
    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, wrong)).toBe(false);

    expect(tokens.rows).toHaveLength(0);
    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, code)).toBe(false);
  });

  it('still accepts the right code after a few wrong guesses below the cap', async () => {
    const { service } = build();
    const code = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);
    const wrong = code === '000000' ? '000001' : '000000';

    await service.consume(EMAIL, VerificationType.PASSWORD_RESET, wrong);
    await service.consume(EMAIL, VerificationType.PASSWORD_RESET, wrong);

    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, code)).toBe(true);
  });

  it('rejects an expired code and removes the token', async () => {
    const { service, tokens } = build();
    const code = await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);

    jest.setSystemTime(Date.now() + OTP_TTL_MS + 1);

    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, code)).toBe(false);
    expect(tokens.rows).toHaveLength(0);
  });

  it('replaces the previous code of the same type: the old one dies, the attempts start over', async () => {
    const { service, tokens } = build();
    const first = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);
    const wrong = first === '000000' ? '000001' : '000000';
    await service.consume(EMAIL, VerificationType.PASSWORD_RESET, wrong);

    const second = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);

    expect(tokens.rows).toHaveLength(1);
    expect(tokens.rows[0].attempts).toBe(0);
    if (first !== second) {
      expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, first)).toBe(false);
    }
    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, second)).toBe(true);
  });

  it('keeps an email verification code and a password reset code apart', async () => {
    const { service } = build();
    const verification = await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);
    const reset = await service.issue(EMAIL, VerificationType.PASSWORD_RESET);

    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, verification === reset ? '' : verification)).toBe(false);
    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, verification)).toBe(true);
    expect(await service.consume(EMAIL, VerificationType.PASSWORD_RESET, reset)).toBe(true);
  });

  it('never accepts a code for a different identifier', async () => {
    const { service } = build();
    const code = await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);

    expect(await service.consume('someone-else@example.test', VerificationType.EMAIL_VERIFICATION, code)).toBe(false);
  });

  it('rejects a code that is not six digits without touching the token', async () => {
    const { service, tokens } = build();
    await service.issue(EMAIL, VerificationType.EMAIL_VERIFICATION);

    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, '12')).toBe(false);
    expect(await service.consume(EMAIL, VerificationType.EMAIL_VERIFICATION, 'abcdef')).toBe(false);
    expect(tokens.rows[0].attempts).toBe(0);
  });
});
