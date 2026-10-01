import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  Provider,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from '@/v1/auth/auth.decorator';
import { RolesGuard } from '@/v1/auth/guards/roles.guard';
import { OwnershipGuard } from '@/v1/common/guards/ownership.guard';
import { AppExceptionsFilter } from '@/common/exceptions/app.exceptions';
import { ZodExceptionFilter } from '@/common/exceptions/zod.exception';

export interface TestUser {
  id: string;
  role: Role;
  email?: string;
  isActive?: boolean;
}

export const TEST_USER_HEADER = 'x-test-user';

export const asUser = (user: TestUser) => ({
  [TEST_USER_HEADER]: JSON.stringify({
    email: `${user.id}@test.local`,
    isActive: true,
    name: user.id,
    ...user,
  }),
});

export const STUDENT_A: TestUser = { id: 'student-a', role: Role.STUDENT };
export const STUDENT_B: TestUser = { id: 'student-b', role: Role.STUDENT };
export const TEACHER_A: TestUser = { id: 'teacher-a', role: Role.TEACHER };
export const TEACHER_B: TestUser = { id: 'teacher-b', role: Role.TEACHER };
export const ADMIN_A: TestUser = { id: 'admin-a', role: Role.ADMIN };

@Injectable()
class HeaderAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest();
    const raw = req.headers[TEST_USER_HEADER];
    if (!raw) throw new UnauthorizedException('Authentication failed');
    req.user = JSON.parse(String(raw));
    return true;
  }
}

export async function createHttpApp(options: {
  controllers: Type<unknown>[];
  providers: Provider[];
  imports?: Type<unknown>[];
  withOwnershipGuard?: boolean;
  rawBody?: boolean;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: options.imports ?? [],
    controllers: options.controllers,
    providers: [
      Reflector,
      { provide: APP_GUARD, useClass: HeaderAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      ...(options.withOwnershipGuard ? [{ provide: APP_GUARD, useClass: OwnershipGuard }] : []),
      ...options.providers,
    ],
  }).compile();

  const app = moduleRef.createNestApplication(options.rawBody ? { rawBody: true } : undefined);
  app.useGlobalFilters(new AppExceptionsFilter(), new ZodExceptionFilter());
  await app.init();
  return app;
}
