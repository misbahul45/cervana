import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Role } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getClass: () => ({} as any),
      getHandler: () => ({} as any),
      getArgs: () => [] as any,
      getArgByIndex: () => ({}),
      getType: () => 'http',
      switchToRpc: () => ({} as any),
      switchToWs: () => ({} as any),
      getByType: () => ({}),
    } as unknown as ExecutionContext;
  });

  it('allows when no @Roles decorator is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('allows when @Roles decorator is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('rejects when user role does not match', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.ADMIN]);
    const ctxWithStudent = {
      ...mockContext,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.STUDENT } }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctxWithStudent)).toThrow(
      ForbiddenException,
    );
  });

  it('allows when user role matches required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.TEACHER]);
    const ctxWithTeacher = {
      ...mockContext,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.TEACHER } }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctxWithTeacher)).toBe(true);
  });

  it('allows when user role matches any of multiple required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.ADMIN, Role.TEACHER]);
    const ctxWithTeacher = {
      ...mockContext,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.TEACHER } }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctxWithTeacher)).toBe(true);
  });

  it('rejects when user is not authenticated', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.STUDENT]);
    const ctxNoUser = {
      ...mockContext,
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctxNoUser)).toThrow(ForbiddenException);
  });
});