// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload, AuthUser } from '@/common/interfaces/auth.interface'
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError } from '@/common/lib/error';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService:AuthService

  ) {
    const jwtSecret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined in configuration');
    }
    super({
      jwtFromRequest: (req: Request): string | null => {
        let token: string | null = null;

        if (req && req.cookies) {
          token = req.cookies['access_token'] || null;
        }

        if (!token && req.headers.authorization) {
          const authHeader = req.headers.authorization;
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }
        }

        return token;
      },
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (!user.isActive) {
      throw new AppError('Akun Anda telah dinonaktifkan. Silakan hubungi admin.', 403);
    }

    if (!user.emailVerified) {
      throw new AppError('Email Anda belum diverifikasi. Silakan cek email Anda.', 403);
    }

    return this.authService.transformUserResponse(user);
  }
}