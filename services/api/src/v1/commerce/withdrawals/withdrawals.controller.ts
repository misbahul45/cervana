import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Controller('v1/commerce/withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN, Role.REVIEWER)
  list(@GetUser('id') userId: string) {
    return this.withdrawals.listByUser(userId);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async request(
    @GetUser('id') userId: string,
    @Body() body: { amount: number },
    @Headers('idempotency-key') key: string,
  ) {
    const wallet = await this.prisma.wallet.findFirst({ where: { ownerId: userId } });
    if (!wallet) throw new Error('wallet_not_found');
    return this.withdrawals.requestWithdrawal({
      creatorId: userId,
      walletId: wallet.id,
      amount: Number(body.amount ?? 0),
      idempotencyKey: key,
    });
  }
}