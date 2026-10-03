import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;
    if (role !== 'ADMIN' && role !== 'REVIEWER') {
      throw new ForbiddenException('admin_or_reviewer_only');
    }
    return true;
  }
}