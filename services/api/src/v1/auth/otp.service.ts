import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationType } from '@prisma/client';
import * as crypto from 'crypto';
import { VerificationTokenRepo } from './verificationToken.repo';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

const CODE_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

export const generateCode = (random: (min: number, max: number) => number = crypto.randomInt): string =>
  String(random(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

export const hashCode = (secret: string, identifier: string, type: VerificationType, code: string): string =>
  crypto.createHmac('sha256', secret).update(`${type}:${identifier}:${code}`).digest('hex');

const sameHash = (left: string, right: string): boolean =>
  left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));

@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly tokens: VerificationTokenRepo,
  ) {
    const base = config.get<string>('OTP_HMAC_SECRET') ?? config.get<string>('JWT_REFRESH_SECRET');
    if (!base) throw new Error('A secret to hash one-time codes with is not configured');
    this.secret = crypto.createHash('sha256').update(`otp-v1:${base}`).digest('hex');
  }

  async issue(identifier: string, type: VerificationType): Promise<string> {
    const code = generateCode();
    await this.tokens.upsert({
      identifier,
      type,
      otp: hashCode(this.secret, identifier, type, code),
      expires: new Date(Date.now() + OTP_TTL_MS),
    });
    return code;
  }

  async consume(identifier: string, type: VerificationType, code: string): Promise<boolean> {
    if (!CODE_PATTERN.test(code)) return false;

    const token = await this.tokens.find(identifier, type);
    if (!token) return false;

    if (token.expires.getTime() <= Date.now() || token.attempts >= OTP_MAX_ATTEMPTS) {
      await this.tokens.deleteById(token.id);
      return false;
    }

    if (!sameHash(token.otp, hashCode(this.secret, identifier, type, code))) {
      const failed = await this.tokens.registerFailure(token.id);
      if (failed && failed.attempts >= OTP_MAX_ATTEMPTS) await this.tokens.deleteById(token.id);
      return false;
    }

    return (await this.tokens.deleteById(token.id)) === 1;
  }
}
