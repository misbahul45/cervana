import { AuthenticatedOnly } from '@/common/authz/access';
import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  BadRequestException,
  Get,
  HttpException,
  HttpStatus,
  Delete,
  Inject,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ARCJET, type ArcjetNest, fixedWindow } from '@arcjet/nest';
import {
  ForgotPasswordDto,
  ForgotPasswordDtoType,
  LoginDto,
  LoginDtoType,
  OtpTypeQueryDto,
  OtpTypeQueryDtoType,
  RegisterDto,
  RegisterDtoType,
  ResetPasswordDto,
  ResetPasswordDtoType,
  VerificationDto,
  VerificationDtoType,
} from './auth.dto';
import { TokenPair } from '@/common/interfaces/auth.interface';
import { SessionClaims } from './session-claims';
import { GetUser, Public } from './auth.decorator';
import { ApiAuthDocs, ApiProtectedDocs } from '@/common/lib/docs';
import { AuthCheckResponseSchema, LoginResponseSchema, RegisterResponseSchema, UserProfileSchema } from '@/common/docs/auth.doc';
import { User } from '@prisma/client'
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_MAX_AGE_MS,
  tokenCookieOptions,
} from './auth-cookies';

const RECOVERY_MESSAGE = 'If the email is registered, a code has been sent';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @Inject(ARCJET) private readonly arcjet: ArcjetNest,
  ) { }

  @Public()
  @Post('register')
  @ApiAuthDocs({
    summary: 'Register new user account',
    description: 'Create a new user account with email verification required',
    body: RegisterDto,
    dataSchema: RegisterResponseSchema,
  })
  async register(
    @Body(new ZodPipe(RegisterDto)) dto: RegisterDtoType,
    @Req() req: Request,
  ) {
    await this.limit(req, '5m', 3, 'Too many registration attempts. Please try again later.');
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiAuthDocs({
    summary: 'User login',
    description: 'Authenticate user credentials and return access tokens via cookies',
    body: LoginDto,
    dataSchema: LoginResponseSchema,
  })
  async login(
    @Body(new ZodPipe(LoginDto)) dto: LoginDtoType,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.limit(req, '1m', 5, 'Too many login attempts. Please try again later.');

    const user = await this.authService.login(dto);
    const tokens = await this.authService.generateTokens({
      id: user.sub,
      email: user.email,
      role: user.role,
    });

    this.setTokenCookies(res, tokens);

    return {
      message: 'Login successful',
      data: {
        id: user.sub,
        email: user.email,
        role: user.role,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      },
    };
  }

  @Public()
  @Post("verify-email")
  @ApiAuthDocs({
    summary: 'Verify email address',
    description: 'Verify user email address using the 6-digit code sent to email',
    body: VerificationDto,
  })
  async verifyEmail(
    @Body(new ZodPipe(VerificationDto)) dto: VerificationDtoType,
    @Req() req: Request,
  ) {
    await this.limit(req, '10m', 10, 'Too many verification attempts. Please try again later.');
    return this.authService.verifyOTP(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiAuthDocs({
    summary: 'Request password reset',
    description: 'Send a password reset code to the email address when it is registered. The answer is the same either way.',
    body: ForgotPasswordDto,
  })
  async forgotPassword(
    @Body(new ZodPipe(ForgotPasswordDto)) dto: ForgotPasswordDtoType,
    @Req() req: Request,
  ) {
    await this.limit(req, '15m', 3, 'Too many password reset requests. Please try again later.');
    await this.authService.requestPasswordReset(dto.email);
    return { message: RECOVERY_MESSAGE, data: null };
  }

  @Public()
  @Post('resend-token')
  @ApiAuthDocs({
    summary: 'Resend code',
    description: 'Resend a verification or password reset code. The answer is the same whether or not the email is registered.',
    body: ForgotPasswordDto,
  })
  async resendToken(
    @Body(new ZodPipe(ForgotPasswordDto)) dto: ForgotPasswordDtoType,
    @Req() req: Request,
    @Query(new ZodPipe(OtpTypeQueryDto)) query: OtpTypeQueryDtoType,
  ) {
    await this.limit(req, '5m', 5, 'Too many resend attempts. Please try again later.');
    await this.authService.resendOtp(dto.email, query.type);
    return { message: RECOVERY_MESSAGE, data: null };
  }

  @Public()
  @Post('refresh-token')
  @ApiProtectedDocs({
    summary: 'refresh access Token',
    description: 'Must be add credential by refresh token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string, data: { access_token: string, refresh_token: string } }> {
    await this.limit(req, '5m', 10, 'Too many refresh attempts. Please try again later.');

    const refreshToken =
      req.cookies?.['refresh_token'] ||
      (req.headers['x-refresh-token'] as string);

    if (!refreshToken) {
      throw new BadRequestException('Refresh token not found');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);

    this.setTokenCookies(res, tokens);

    return {
      message: 'Tokens refreshed successfully',
      data: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      }
    };
  }

  @Public()
  @Post('reset-password')
  @ApiAuthDocs({
    summary: 'Reset user password',
    description: 'Reset user password using the 6-digit code sent to email. Every signed-in device is signed out.',
    body: ResetPasswordDto
  })
  async resetPassword(
    @Body(new ZodPipe(ResetPasswordDto)) dto: ResetPasswordDtoType,
    @Req() req: Request,
  ) {
    await this.limit(req, '15m', 5, 'Too many password reset attempts. Please try again later.');
    return this.authService.resetPassword(dto);
  }

  @Delete('logout')
  @ApiProtectedDocs({
    summary: 'logout authentication',
    description: 'logout user account'
  })
  @AuthenticatedOnly()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.revokeSessionOf(this.accessTokenOf(req));
    this.clearTokenCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @ApiProtectedDocs({
    summary: 'Get current user profile',
    description: 'Retrieve authenticated user profile information',
    dataSchema: UserProfileSchema,
  })
  @AuthenticatedOnly()
  async getProfile(
    @GetUser() user: User,
  ): Promise<{ message: string; data: any }> {
    const { password, ...res } = user
    return {
      message: 'Profile retrieved successfully',
      data: res
    };
  }

  @Get('check')
  @ApiProtectedDocs({
    summary: 'Check authentication status',
    description: 'Verify if user is authenticated and return user data',
    dataSchema: AuthCheckResponseSchema,
  })
  @AuthenticatedOnly()
  async checkAuth(
    @GetUser() user: User,
  ): Promise<{
    data: {
      authenticated: boolean; user: Omit<User, 'password'> & SessionClaims
    }
  }> {
    const { password, ...res } = user
    const claims = await this.authService.getSessionClaims(user.id, user.role);
    return {
      data: {
        authenticated: true,
        user: { ...res, ...claims },
      }
    };
  }

  private async limit(req: Request, window: '1m' | '5m' | '10m' | '15m', max: number, message: string): Promise<void> {
    const decision = await this.arcjet
      .withRule(fixedWindow({ mode: 'LIVE', window, max }))
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private accessTokenOf(req: Request): string | undefined {
    const fromCookie = req.cookies?.['access_token'];
    if (fromCookie) return fromCookie;
    const header = req.headers?.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }

  private cookieOptions() {
    return tokenCookieOptions({
      production: this.configService.get<string>('NODE_ENV') === 'production',
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
    });
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const options = this.cookieOptions();

    res.cookie('access_token', tokens.accessToken, { ...options, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie('refresh_token', tokens.refreshToken, { ...options, maxAge: REFRESH_COOKIE_MAX_AGE_MS });
  }

  private clearTokenCookies(res: Response): void {
    const options = this.cookieOptions();

    res.clearCookie('access_token', options);
    res.clearCookie('refresh_token', options);
  }
}
