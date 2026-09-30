import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import z from 'zod';
import { AuthenticatedOnly } from '@/common/authz/access';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser } from '../auth/auth.decorator';
import { WalletService } from './wallet.service';

const LedgerQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type LedgerQuery = z.infer<typeof LedgerQueryDto>;

@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletService) {}

  @Get('mine')
  @AuthenticatedOnly()
  mine(@GetUser() user: AuthUser) {
    return this.wallets.listMine(user);
  }

  @Get(':id')
  @AuthenticatedOnly()
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.wallets.findOne(user, id);
  }

  @Get(':id/ledger')
  @AuthenticatedOnly()
  ledger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(LedgerQueryDto)) query: LedgerQuery,
    @GetUser() user: AuthUser,
  ) {
    return this.wallets.ledgerOf(user, id, query.page, query.limit);
  }
}
