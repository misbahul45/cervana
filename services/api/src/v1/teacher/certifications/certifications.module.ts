import { Module } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CertificationsController } from './certifications.controller';
import { CertificationsRepo } from './certifications.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [CertificationsController],
  providers: [CertificationsService, CertificationsRepo],
  exports: [CertificationsService, CertificationsRepo],
})
export class CertificationsModule {}
