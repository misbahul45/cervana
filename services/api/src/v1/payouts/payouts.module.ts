import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { CommerceCoreModule } from '../commerce/commerce-core.module';
import { LedgerModule } from '../ledger/ledger.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminPayoutsController, PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [PrismaModule, LedgerModule, CommerceCoreModule, UploadsModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
