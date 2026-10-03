import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { StudioEarningsController } from './studio-earnings.controller';
import { StudioEarningsService } from './studio-earnings.service';

@Module({
  imports: [PrismaModule],
  controllers: [StudioEarningsController],
  providers: [StudioEarningsService],
  exports: [StudioEarningsService],
})
export class StudioEarningsModule {}