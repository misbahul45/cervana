import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { CreditPackageController } from './credit-package.controller';
import { CreditPackageService } from './credit-package.service';

@Module({
  imports: [PrismaModule],
  controllers: [CreditPackageController],
  providers: [CreditPackageService],
  exports: [CreditPackageService],
})
export class CreditPackageModule {}