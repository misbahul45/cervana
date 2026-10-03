import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ReservationCommitService } from './reservation-commit.service';

@Module({
  imports: [PrismaModule],
  providers: [ReservationCommitService],
  exports: [ReservationCommitService],
})
export class ReservationCommitModule {}