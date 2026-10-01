import { AuthenticatedOnly } from '@/common/authz/access';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser } from '../auth/auth.decorator';
import { OrdersService } from './orders.service';
import {
  CreateOrderRequestDto,
  CreateOrderRequestDtoType,
  OrderListQueryDto,
  OrderListQueryDtoType,
} from './orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @AuthenticatedOnly()
  create(
    @Body(new ZodPipe(CreateOrderRequestDto)) dto: CreateOrderRequestDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.ordersService.create(user, dto, traceId);
  }

  @Get()
  @AuthenticatedOnly()
  findAll(
    @Query(new ZodPipe(OrderListQueryDto)) query: OrderListQueryDtoType,
    @GetUser() user: AuthUser,
  ) {
    return this.ordersService.findAll(user, query);
  }

  @Get(':id')
  @AuthenticatedOnly()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('include') include: string | undefined,
    @GetUser() user: AuthUser,
  ) {
    return this.ordersService.findOne(user, id, include === 'topic' ? 'topic' : undefined);
  }

  @Post(':id/cancel')
  @AuthenticatedOnly()
  cancel(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.ordersService.cancelOrder(user, id, traceId);
  }
}
