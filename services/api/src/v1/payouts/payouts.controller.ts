import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '../auth/auth.decorator';
import { ReasonDto, ReasonDtoType } from '../marketplace/marketplace.dto';
import {
  AdminPayoutQueryDto,
  AdminPayoutQueryDtoType,
  MarkPaidDto,
  MarkPaidDtoType,
  PayoutQueryDto,
  PayoutQueryDtoType,
  RequestPayoutDto,
  RequestPayoutDtoType,
} from './payouts.dto';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Roles(Role.TEACHER)
  @Post()
  request(@Body(new ZodPipe(RequestPayoutDto)) dto: RequestPayoutDtoType, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.payouts.request(user, dto, traceId);
  }

  @Roles(Role.TEACHER)
  @Get()
  list(@Query(new ZodPipe(PayoutQueryDto)) query: PayoutQueryDtoType, @GetUser() user: AuthUser) {
    return this.payouts.listMine(user, query);
  }

  @Roles(Role.TEACHER)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.payouts.findMine(user, id);
  }

  @Roles(Role.TEACHER)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.payouts.cancel(user, id, traceId);
  }
}

@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Roles(Role.ADMIN)
  @Get()
  queue(@Query(new ZodPipe(AdminPayoutQueryDto)) query: AdminPayoutQueryDtoType, @GetUser() user: AuthUser) {
    return this.payouts.queue(user, query);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.payouts.findOne(user, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/start-review')
  startReview(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.payouts.startReview(user, id, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.payouts.approve(user, id, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/mark-paid')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(MarkPaidDto)) dto: MarkPaidDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.payouts.markPaid(user, id, dto, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReasonDto)) dto: ReasonDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.payouts.reject(user, id, dto.reason, traceId);
  }
}
