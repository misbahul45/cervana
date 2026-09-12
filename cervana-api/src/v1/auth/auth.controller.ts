import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  BadRequestException,
  UseGuards,
  Get,
  Request as NestRequest,
  Inject,
  HttpException,
  HttpStatus,
  Delete,
  Query
} from '@nestjs/common';
import {
  ApiTags,
} from '@nestjs/swagger';
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
  RegisterDto,
  RegisterDtoType,
  ResetPasswordDto,
  ResetPasswordDtoType,
  VerificationDto,
  VerificationDtoType,
} from './auth.dto';
import { TokenPair } from '@/common/interfaces/auth.interface';
import { GetUser, Public } from './auth.decorator';
import { GoogleOAuthGuard } from './guards/google.guard';
import { ApiAuthDocs, ApiProtectedDocs } from '@/common/lib/docs';
import { AuthCheckResponseSchema, LoginResponseSchema, RegisterResponseSchema, UserProfileSchema } from '@/common/docs/auth.doc';
import { User } from '@prisma/client'

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
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '5m',
          max: 3,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many registration attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
     
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
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '1m',
          max: 5,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

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
        access_token:tokens.accessToken,
        refresh_token:tokens.refreshToken
      },
    };
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@NestRequest() req) {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(
    @NestRequest() req,
    @Res() res: Response,
  ) {
    const { tokens, ...data } = await this.authService.googleLogin(req);

    this.setTokenCookies(res, tokens);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') 
      || "http://localhost:3000";

    return res.redirect(`${frontendUrl}/learn/topics`);
  }

  @Public()
  @Post("verify-email")
  @ApiAuthDocs({
    summary: 'Verify email address',
    description: 'Verify user email address using OTP sent to email',
    body: VerificationDto,
  })
  async verifyEmail(
    @Body(new ZodPipe(VerificationDto)) dto: VerificationDtoType,
    @Req() req: Request,
  ) {
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '10m',
          max: 10,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many verification attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.authService.verifyOTP({
      ...dto
    });
  }

  @Public()
  @Post('forgot-password')
  @ApiAuthDocs({
    summary: 'Request password reset',
    description: 'Send password reset OTP to user email address',
    body: ForgotPasswordDto,
  })
  async forgotPassword(
    @Body(new ZodPipe(ForgotPasswordDto)) dto: ForgotPasswordDtoType,
    @Req() req: Request,
    @Query('type') type:string
  ) {
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '15m',
          max: 3,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many password reset requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const res_data = await this.authService.sendOtp({
      email: dto.email
    }, type);

    if (res_data.success) {
      return {
        message: 'Successfully sent OTP',
        data: null
      };
    }
  }

  @Public()
  @Post('resend-token')
  @ApiAuthDocs({
    summary: 'Resend OTP token',
    description: 'Resend OTP token to user email address',
    body: ForgotPasswordDto,
  })
  async resendToken(
    @Body(new ZodPipe(ForgotPasswordDto)) dto: ForgotPasswordDtoType,
    @Req() req: Request,
    @Query('type') type:string
  ) {
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '5m',
          max: 5,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many resend attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const res_data = await this.authService.sendOtp({
      email: dto.email,
    }, type);

    if (res_data.success) {
      return {
        message: 'Successfully resent OTP',
        data: null
      };
    }
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
  ): Promise<{ message: string, data: { access_token:string, refresh_token:string } }> {
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '5m',
          max: 10,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many refresh attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const refreshToken =
      req.cookies?.['refresh_token'] ||
        (req.headers['x-refresh-token'] as string);

    if (!refreshToken) {
      throw new BadRequestException('Refresh token not found');
    }

    const payload = await this.authService.verifyRefreshToken(refreshToken);
    const tokens = await this.authService.generateTokens({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    this.setTokenCookies(res, tokens);

    return { message: 'Tokens refreshed successfully', data:{
        access_token:tokens.accessToken,
        refresh_token:tokens.accessToken
      } 
    };
  }

  @Public()
  @Post('reset-password')
  @ApiAuthDocs({
    summary: 'Reset user password',
    description: 'Reset user password using OTP sent to email',
    body: ResetPasswordDto
  })
  async resetPassword(
    @Body(new ZodPipe(ResetPasswordDto)) dto: ResetPasswordDtoType,
    @Req() req: Request,
  ) {
    const decision = await this.arcjet
      .withRule(
        fixedWindow({
          mode: 'LIVE',
          window: '15m',
          max: 5,
        }),
      )
      .protect(req);

    if (decision.isDenied()) {
      throw new HttpException(
        'Too many password reset attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.authService.resetPassword(dto);
  }

  @Delete('logout')
  @ApiProtectedDocs({
    summary: 'logout authentication',
    description: 'logout user account'
  })
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    console.log("logoutingg ....")
    this.clearTokenCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @ApiProtectedDocs({
    summary: 'Get current user profile',
    description: 'Retrieve authenticated user profile information',
    dataSchema: UserProfileSchema,
  })
  async getProfile(
    @GetUser() user: User,
  ): Promise<{ message: string; data: any }> {

    const { password, ...res }=user
    return {
      message: 'Profile retrieved successfully',
      data:res
    };
  }

  @Get('check')
  @ApiProtectedDocs({
    summary: 'Check authentication status',
    description: 'Verify if user is authenticated and return user data',
    dataSchema: AuthCheckResponseSchema,
  })
  async checkAuth(
    @GetUser() user: User,
  ): Promise<{
    data: {
      authenticated: boolean; user: Omit<User, 'password'>
    }
  }> {
    const { password, ...res }=user
    return {
      data: {
        authenticated: true,
        user:res,
      }
    };
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN');

    const cookieOptions = {
      httpOnly: true,
      secure: true,             // wajib kalau sameSite='none'
      sameSite: 'none' as const, // wajib untuk cross-site cookie
      domain: domain || undefined,
      path: '/',
    };

    res.cookie('access_token', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }


private clearTokenCookies(res: Response): void {
  const domain = this.configService.get<string>('COOKIE_DOMAIN');

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      domain: domain || undefined,
      path: '/',
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }

}