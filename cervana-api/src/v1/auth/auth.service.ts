import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDtoType, RegisterDtoType, ResetPasswordDtoType } from './auth.dto';
import { sendOTPVerificationEmail } from '@/common/lib/email';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';

import {
  AuthUser,
  GoogleLoginResponse,
  JwtPayload,
  RegisterResponse,
  SendOtpResponse,
  TokenPair,
  VerifyOtpResponse,
} from '@/common/interfaces/auth.interface';
import { SessionRepo } from './sessions.repo';
import { UsersRepo } from '../users/users.repo';
import { VerificationTokenRepo } from './verificationToken.repo';
import { AuthProvider, Role, User, VerificationType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionRepo: SessionRepo,
    private readonly userService: UsersRepo,
    private readonly verificationTokenRepo: VerificationTokenRepo
  ) { }

  async register(dto: RegisterDtoType): Promise<RegisterResponse> {
    return errorHandler(async () => {
      const userExists = await this.userService.findOne('email', dto.email)

      if (userExists) {
        throw new AppError(
          'Email already registered',
          400,
          AppErrorCode.EMAIL_ALREADY_REGISTERED,
        );
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const user = await this.userService.create({
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        provider:AuthProvider.JWT
      })

      await this.sendOtp({
        name: user.name,
        email: user.email
      })

      return {
        message:
          'User registered successfully. Please check your email for verification.',
        data: {
          id: user.id,
          email: user.email,
        },
      };
    });
  }


  async googleLogin(req): Promise<GoogleLoginResponse> {
    return errorHandler(async () => {
      if (!req.user) {
        throw new AppError('Google client error');
      }

      const { email, name, picture } = req.user;

      const user = await this.userService.findOne('email', email);

      if (!user) {
        const newUser = await this.userService.create({
          email,
          name,
          ...(picture && { image:{
            url:picture
          } }),
          provider: AuthProvider.Google,
          emailVerified: new Date(),
        });

        const tokens = await this.generateTokens({
          email: newUser.email,
          role: newUser.role,
          id: newUser.id,
        });

        return {
          message: 'User information from Google',
          data: {
            id: newUser.id,
            email: newUser.email,
          },
          tokens,
        };
      }

      const tokens = await this.generateTokens({
        email: user.email,
        role: user.role,
        id: user.id,
      });

      return {
        message: 'User information from Google',
        data: {
          id: user.id,
          email: user.email,
        },
        tokens,
      };
    });
  }


  async sendOtp(user: {
    email: string,
    name?: string,
  }, type?:string): Promise<SendOtpResponse> {
    return errorHandler(async () => {
      const otp = crypto.randomInt(100000, 999999).toString();

      let userTarget = user;

      if (!user.name) {
        const foundUser = await this.userService.findOne('email', user.email)
        if (!foundUser) {
          throw new AppError('User not found', 404, AppErrorCode.USER_NOT_FOUND);
        }
        userTarget = foundUser;
      }
      await this.verificationTokenRepo.deleteByIdentifier(userTarget.email)  
      await this.verificationTokenRepo.create({
        identifier: userTarget.email,
        otp,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type:type =='pw'?VerificationType.PASSWORD_RESET: VerificationType.EMAIL_VERIFICATION,
      })

      await sendOTPVerificationEmail({
        to: userTarget.email,
        username: userTarget?.name ?? '',
        token: otp,
      });

      return {
        success: true
      }
    })
  }

  async login(dto: LoginDtoType) {
    return errorHandler(async () => {
      const user = await this.userService.findOne('email', dto.email)

      if (!user) {
        throw new AppError('User not found', 404, AppErrorCode.USER_NOT_FOUND);
      }

      if(!user.emailVerified){
        throw new AppError('Unverified email')
      }

      if (!user?.password) {
        throw new AppError('Invalid auth provider')
      }
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        user.password,
      );


      if (!isPasswordValid) {
        throw new AppError(
          'Invalid email or password',
          400,
          AppErrorCode.VALIDATION_ERROR,
        );
      }

      return {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
    });
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


  async resetPassword(
    values:ResetPasswordDtoType
  ){
    return errorHandler(async()=>{
      const findOtp = await this.verificationTokenRepo.find(values.identifier, values.otp)
      
      if (!findOtp || findOtp.type !== VerificationType.PASSWORD_RESET) {
        throw new AppError("Token not found", 404)
      }
      const user = await this.userService.findOne('email', values.identifier)
      if (!user) {
        throw new AppError('User not found', 404)
      }


      await this.verificationTokenRepo.delete(user.email, findOtp.otp)
      
      const hashedPassword = await bcrypt.hash(values.newPassword, 10);
      await this.userService.update({
        values:{
          password:hashedPassword
        },
        id:user.id
      })
      return {
        message: 'Successfully change password',
        data: null
      }
    })
  }


  async verifyOTP({ identifier, otp }: { identifier: string; otp: string }): Promise<VerifyOtpResponse> {
    return errorHandler(async () => {
      const findOtp = await this.verificationTokenRepo.find(identifier, otp)

      if (!findOtp || findOtp.type !== VerificationType.EMAIL_VERIFICATION) {
        const findUser=await this.userService.findOne('email', identifier)

        if(findUser?.emailVerified){
          return{
            message:'Successfully verified',
            data:null
          }
        }
        throw new AppError("Token not found", 404)
      }

      await this.verificationTokenRepo.delete(identifier, otp)

      await this.userService.update({
        values: {
          email: identifier,
          emailVerified: new Date()
        }
      })
      return {
        message: 'Successfully verify token',
        data: null
      }
    })
  }

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.userService.findOne('id', payload.sub)

    if (!user) {
      throw new AppError('User not found', 404);
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


      if (payload.type !== 'refresh') {
        throw new AppError('Invalid token type');
      }

      if (!payload.sessionToken) {
        throw new AppError('Session token is missing');
      }
      const session = await this.sessionRepo.findSessionByToken(
        payload.sessionToken,
      );

      if (!session || session.expires < new Date()) {
        throw new AppError('Session expired');
      }

      return payload;
    } catch {
      throw new AppError('Invalid refresh token');
    }
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      if (!payload.sessionToken) {
        throw new AppError('Session token is missing');
      }
      const session = await this.sessionRepo.findSessionByToken(
        payload.sessionToken,
      );

      if (!session || session.expires < new Date()) {
        throw new AppError('Session expired');
      }

      const user = await this.userService.findOne('id', session.userId)

      if (!user) {
        throw new AppError('Account is deactivated');
      }

      return payload;
    } catch {
      throw new AppError('Invalid access token');
    }
  }

  // ==================== Logout ====================
  async logout(sessionToken: string): Promise<void> {
    if (sessionToken) {
      await this.sessionRepo.deleteSession(sessionToken);
    }
  }

  async logoutAll(userId: string, exceptSessionToken?: string): Promise<void> {
    await this.sessionRepo.revokeAllUserSessions(userId, exceptSessionToken);
  }

  // ==================== Helper ====================
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
