import { SetMetadata } from '@nestjs/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { Role } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);


export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const GetUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser[keyof AuthUser] | AuthUser | null => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);