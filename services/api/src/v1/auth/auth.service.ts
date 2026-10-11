import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDtoType, RegisterDtoType, ResetPasswordDtoType } from './auth.dto';
import { sendOTPVerificationEmail } from '@/common/lib/email';
import { AppError, AppErrorCode } from '@/common/lib/error';

import {
  AuthUser,
  JwtPayload,
  RegisterResponse,
  TokenPair,
  VerifyOtpResponse,
} from '@/common/interfaces/auth.interface';
import { SessionRepo } from './sessions.repo';
import { SessionClaims, deriveSessionClaims } from './session-claims';
import { UsersRepo } from '../users/users.repo';
import { OtpService } from './otp.service';
import { AuthProvider, Role, User, VerificationType } from '@prisma/client';

export const BCRYPT_ROUNDS = 12;
export const DUMMY_PASSWORD_HASH = '$2b$12$4b1C2oUTzPfS.6rTWQMu3e7RsfGWOYepLaISNEQaXs2hVIrLwr2Qu';

export type OtpKind = 'email' | 'pw';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const invalidCredentials = () =>
  new AppError('Invalid email or password', 400, AppErrorCode.VALIDATION_ERROR);

const invalidCode = () => new AppError('Invalid or expired code', 400, AppErrorCode.INVALID_OTP);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionRepo: SessionRepo,
    private readonly userService: UsersRepo,
    private readonly otp: OtpService,
  ) { }

  async register(dto: RegisterDtoType): Promise<RegisterResponse> {
    const email = normalizeEmail(dto.email);
    const existing = await this.userService.findOne('email', email);

    if (existing?.emailVerified) {
      throw new AppError('Email already registered', 400, AppErrorCode.EMAIL_ALREADY_REGISTERED);
    }

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = existing
      ? await this.userService.update({ id: existing.id, values: { name: dto.name, password } })
      : await this.userService.create({ email, password, name: dto.name, provider: AuthProvider.JWT });

    await this.deliverCode(user.email, user.name, VerificationType.EMAIL_VERIFICATION);

    return {
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async login(dto: LoginDtoType) {
    const user = await this.userService.findOne('email', normalizeEmail(dto.email));
    const passwordMatches = await bcrypt.compare(dto.password, user?.password ?? DUMMY_PASSWORD_HASH);

    if (!user || !user.password || !passwordMatches || !user.isActive) {
      throw invalidCredentials();
    }

    if (!user.emailVerified) {
      throw new AppError('Unverified email', 403, AppErrorCode.EMAIL_VERIFICATION_FAILED);
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async verifyOTP({ identifier, otp }: { identifier: string; otp: string }): Promise<VerifyOtpResponse> {
    const email = normalizeEmail(identifier);
    const accepted = await this.otp.consume(email, VerificationType.EMAIL_VERIFICATION, otp);
    const user = accepted ? await this.userService.findOne('email', email) : null;

    if (!user) {
      throw invalidCode();
    }

    if (!user.emailVerified) {
      await this.userService.update({ id: user.id, values: { emailVerified: new Date() } });
    }

    return { message: 'Successfully verified', data: null };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.dispatchRecoveryCode(email, VerificationType.PASSWORD_RESET);
  }

  async resendOtp(email: string, kind: OtpKind): Promise<void> {
    const type = kind === 'pw' ? VerificationType.PASSWORD_RESET : VerificationType.EMAIL_VERIFICATION;
    await this.dispatchRecoveryCode(email, type);
  }

  async resetPassword(values: ResetPasswordDtoType) {
    const email = normalizeEmail(values.identifier);
    const accepted = await this.otp.consume(email, VerificationType.PASSWORD_RESET, values.otp);
    const user = accepted ? await this.userService.findOne('email', email) : null;

    if (!user || !user.isActive) {
      throw invalidCode();
    }

    const password = await bcrypt.hash(values.newPassword, BCRYPT_ROUNDS);
    await this.userService.update({
      id: user.id,
      values: user.emailVerified ? { password } : { password, emailVerified: new Date() },
    });
    await this.sessionRepo.revokeAllUserSessions(user.id);

    return {
      message: 'Successfully change password',
      data: null,
    };
  }

  private async dispatchRecoveryCode(rawEmail: string, type: VerificationType): Promise<void> {
    const user = await this.userService.findOne('email', normalizeEmail(rawEmail));

    if (!user || !user.isActive) return;
    if (type === VerificationType.EMAIL_VERIFICATION && user.emailVerified) return;

    void this.deliverCode(user.email, user.name, type).catch((error: unknown) => {
      this.logger.error(`Could not deliver a ${type} code: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async deliverCode(email: string, name: string | null | undefined, type: VerificationType): Promise<void> {
    const token = await this.otp.issue(email, type);
    await sendOTPVerificationEmail({ to: email, username: name ?? '', token });
  }

  async generateTokens(
    user: { email: string; id: string; role: Role },
  ): Promise<TokenPair> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpires = new Date();
    sessionExpires.setDate(sessionExpires.getDate() + 30); 

    await this.sessionRepo.createSession(user.id, sessionToken, sessionExpires);

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionToken,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;

    const accessExpiresIn =
      (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') as
        | `${number}${'s' | 'm' | 'h' | 'd'}`
        | number
        | undefined) ?? '1d'; 

    const refreshExpiresIn =
      (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') as
        | `${number}${'s' | 'm' | 'h' | 'd'}`
        | number
        | undefined) ?? '30d'; 

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken, sessionToken };
  }


  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.userService.findOne('id', payload.sub);

    if (!user || !user.isActive) {
      throw new AppError('Invalid refresh token', 401, AppErrorCode.UNAUTHORIZED);
    }

    if (payload.sessionToken) {
      await this.sessionRepo.deleteSession(payload.sessionToken);
    }

    return this.generateTokens(user);
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh' || !payload.sessionToken) {
        throw new Error('Not a refresh token');
      }

      const session = await this.sessionRepo.findSessionByToken(payload.sessionToken);

      if (!session || session.expires < new Date()) {
        throw new Error('Session expired');
      }

      return payload;
    } catch {
      throw new AppError('Invalid refresh token', 401, AppErrorCode.UNAUTHORIZED);
    }
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      if (!payload.sessionToken) {
        throw new Error('Session token is missing');
      }
      const session = await this.sessionRepo.findSessionByToken(payload.sessionToken);

      if (!session || session.expires < new Date()) {
        throw new Error('Session expired');
      }

      const user = await this.userService.findOne('id', session.userId);

      if (!user) {
        throw new Error('Account is deactivated');
      }

      return payload;
    } catch {
      throw new AppError('Invalid access token', 401, AppErrorCode.UNAUTHORIZED);
    }
  }

  async revokeSessionOf(accessToken: string | undefined): Promise<void> {
    if (!accessToken) return;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.sessionToken) {
        await this.sessionRepo.deleteSession(payload.sessionToken);
      }
    } catch {
      return;
    }
  }

  async logout(sessionToken: string): Promise<void> {
    if (sessionToken) {
      await this.sessionRepo.deleteSession(sessionToken);
    }
  }

  async logoutAll(userId: string, exceptSessionToken?: string): Promise<void> {
    await this.sessionRepo.revokeAllUserSessions(userId, exceptSessionToken);
  }

  async getSessionClaims(userId: string, role: Role): Promise<SessionClaims> {
    const memberships = await this.userService.findActiveMembershipRoles(userId);
    return deriveSessionClaims(role, memberships);
  }

  transformUserResponse(user: User): AuthUser {
    const image = user.image as unknown as { url: string; fileId?: string } | string | null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      image: image
        ? typeof image === "string"
          ? { url: image }
          : { url: image.url, fileId: image.fileId }
        : null,
      provider: user.provider,
    };
  }
}
