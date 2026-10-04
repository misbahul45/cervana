import { Body, Controller, Get, ParseUUIDPipe, Post, Query, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '../auth/auth.decorator';
import { RequireIdempotencyKey } from '@/common/idempotency/require-idempotency-key.decorator';
import { ReasonDto, ReasonDtoType } from '../marketplace/marketplace.dto';
import {
  AdminCreateRefundDto,
  AdminCreateRefundDtoType,
  ProcessRefundDto,
  ProcessRefundDtoType,
  RefundQueryDto,
  RefundQueryDtoType,
  RequestRefundDto,
  RequestRefundDtoType,
} from './refunds.dto';
import { RefundsService } from './refunds.service';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @AuthenticatedOnly()
  @Get('mine')
  mine(@Query(new ZodPipe(RefundQueryDto)) query: RefundQueryDtoType, @GetUser() user: AuthUser) {
    return this.refunds.listMine(user, query);
  }
}

@Controller('orders')
export class OrderRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @AuthenticatedOnly()
  @Post(':id/refund-requests')
  @RequireIdempotencyKey()
  request(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(RequestRefundDto)) dto: RequestRefundDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.refunds.request(user, id, dto.reason, traceId);
  }
}

@Controller('admin/refunds')
export class AdminRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Roles(Role.ADMIN)
  @Get()
  queue(@Query(new ZodPipe(RefundQueryDto)) query: RefundQueryDtoType, @GetUser() user: AuthUser) {
    return this.refunds.queue(user, query);
  }

  @Roles(Role.ADMIN)
  @Post()
  @RequireIdempotencyKey()
  create(@Body(new ZodPipe(AdminCreateRefundDto)) dto: AdminCreateRefundDtoType, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.refunds.request(user, dto.orderId, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.refunds.findOne(user, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  @RequireIdempotencyKey()
  approve(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.refunds.approve(user, id, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  @RequireIdempotencyKey()
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReasonDto)) dto: ReasonDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.refunds.reject(user, id, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/process')
  @RequireIdempotencyKey()
  process(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ProcessRefundDto)) dto: ProcessRefundDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.refunds.process(user, id, dto, traceId);
  }
}