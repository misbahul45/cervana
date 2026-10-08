import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { RedisModule } from '@/common/config/redis/redis.service';
import { PolicyService } from './policy.service';
import { AuditService } from './audit.service';
import { InternalServiceGuard } from './internal-service.guard';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [PolicyService, AuditService, InternalServiceGuard],
  exports: [PolicyService, AuditService, PrismaModule, RedisModule, InternalServiceGuard],
})
export class AuthzModule {}
