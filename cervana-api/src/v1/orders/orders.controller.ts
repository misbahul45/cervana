import { Controller, Get, Post, Body, Patch, Param, Delete, Query, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Query as OrdersQuery } from '@/common/interfaces';
import { GetUser } from '../auth/auth.decorator';
import { User } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

@Post()
async create(
  @Body('topicId') topicId: string,
  @GetUser() user: User
) {

  return this.ordersService.create({
    topicId,
    userId:user.id
  });
}


  @Get()
  findAll(
    @Query() q: OrdersQuery
  ) {
    return this.ordersService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: any) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
