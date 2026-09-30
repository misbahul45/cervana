import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { PolicyService } from './policy.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PolicyService, AuditService],
  exports: [PolicyService, AuditService, PrismaModule],
})
export class AuthzModule {}
