// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt.guard';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { GoogleOAuthGuard } from './guards/google.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { VerificationTokenRepo } from './verificationToken.repo';
import { SessionRepo } from './sessions.repo';
import { UsersModule } from '../users/users.module';
import { SseJwtGuard } from './guards/sse-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') as any,
        },
        global: true,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    SseJwtGuard,
    PrismaService,
    GoogleOAuthGuard,
    GoogleStrategy,
    VerificationTokenRepo,
    SessionRepo,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    SseJwtGuard,
    VerificationTokenRepo,
    SessionRepo,
    JwtModule,       
  ]
})
export class AuthModule {}
