// auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth.decorator';
import { AppError } from '@/common/lib/error';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      const accessToken =
        request.cookies?.['access_token'] ||
        request.headers?.authorization?.replace('Bearer ', '');
      
      const refreshToken=request.cookies?.['refresh_token'] ||
        request.headers?.authorization?.replace('Bearer ', '');

      if (!accessToken && refreshToken) {
        throw new AppError('invalid token', 401);
      }

      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token');
      }

      throw err || new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}
