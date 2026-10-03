// src/v1/auth/strategies/google.strategy.ts
import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthProvider } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Optional() _config?: never) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('GOOGLE_OAUTH_DISABLED');
    }
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3002/api/v1/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, name, photos } = profile;

    if (!emails || emails.length === 0) {
      return done(new Error('Google account has no email'), false);
    }

    const email = emails[0]?.value ?? null;
    const picture = photos?.[0]?.value ?? null;

    if (!email) {
      return done(new Error('Google email not found'), false);
    }

    const user = {
      email,
      name: `${name?.givenName ?? ''} ${name?.familyName ?? ''}`.trim(),
      picture,
      provider: AuthProvider.Google,
    };

    return done(null, user);
  }
}