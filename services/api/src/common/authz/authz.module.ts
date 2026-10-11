import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { RedisModule } from '@/common/config/redis/redis.service';
import { PolicyService } from './policy.service';
import { AuditService } from './audit.service';
import { InternalServiceGuard } from './internal-service.guard';
import { ActingUserGuard } from './acting-user.guard';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [PolicyService, AuditService, InternalServiceGuard, ActingUserGuard],
  exports: [PolicyService, AuditService, PrismaModule, RedisModule, InternalServiceGuard, ActingUserGuard],
})
export class AuthzModule {}
