import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import { WalletsController } from './wallets.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WalletsController],
  providers: [LedgerService, WalletService],
  exports: [LedgerService, WalletService],
})
export class LedgerModule {}
