import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { CreditPackageService } from './credit-package.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Controller('v1/commerce/credit-packages')
@UseGuards(JwtAuthGuard)
export class CreditPackageController {
  constructor(
    private readonly packages: CreditPackageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  list() {
    return this.packages.list();
  }

  @Post(':slug/purchase')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async purchase(
    @GetUser('id') userId: string,
    @Param('slug') slug: string,
    @Headers('idempotency-key') key: string,
  ) {
    const wallet = await this.prisma.wallet.findFirst({ where: { ownerId: userId } });
    if (!wallet) throw new Error('wallet_not_found');
    return this.packages.purchase({ userId, slug, idempotencyKey: key, walletId: wallet.id });
  }
}