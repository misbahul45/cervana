import { Injectable } from '@nestjs/common';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query } from '@/common/interfaces';
import { OrdersRepo } from './orders.repo';
import { CreateOrderDtoType, UpdateOrderDtoType } from './orders.dto';
import { UserTopicsRepo } from '../learning/user-topics/user-topics.repo';
import { TopicsRepo } from '../curriculum/topics/topics.repo';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepo: OrdersRepo,
    private readonly userTopicsRepo: UserTopicsRepo,
    private readonly topicsRepo:TopicsRepo,
  ) {}

  async create(values:{
    userId:string,
    topicId:string
  }) {
    return errorHandler(async () => {
      if(!values.topicId){
        throw new AppError('Topic id ot found')
      }
      const topic=await this.topicsRepo.findOne('id', values.topicId)

      if(!topic){
        throw new AppError('Topic not found', 404, AppErrorCode.NOT_FOUND)
      }
      const topicPrice = topic.price ?? 0;
      const supportsIDR = false;
      const exchangeRate = 16726;
      const currency = supportsIDR ? 'idr' : 'usd';
      const amount = supportsIDR
        ? Math.round(topicPrice)
        : Math.round((topicPrice / exchangeRate) * 100);

      console.log('Amount in cents:', amount, 'Currency:', currency);

      let snapToken: string | undefined = undefined;

      if (topic?.price!==0) {

        snapToken = 't1kjk26u1756291829172h51792783dkusuduy'
      }

      const newOrder = await this.ordersRepo.create(
        {
          userId: values.userId,
          topicId: values.topicId,
          amount,
          status: topic?.price == 0 ? 'PAID' : 'PENDING',
          currency,
          gateway: topic?.price === 0 ? 'manual' : 'stripe',
          snapToken,
          expiredAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
        },
        topic?.price === 0 ? { paidAt: new Date() } : undefined
      );



      if (topic.price === 0) {
        await this.userTopicsRepo.create({
          userId: values.userId,
          topicId: values.topicId,
          accessType: 'FREE',
          status: 'NOT_STARTED',
          progressPercent: 0,
          purchasedAt: new Date(),
        });
      }
      return {
        success: true,
        message: 'Successfully created order',
        data: { ...newOrder },
      };
    });
  }




  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.ordersRepo.findAll(q);

      return {
        message: 'Successfully retrieved orders',
        data: {
          data: result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
          },
        },
      };
    });
  }

  findOne(id: string) {
    return errorHandler(async () => {
      const order = await this.ordersRepo.findOne('id', id);

      if (!order?.id) {
        throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
      }

      return {
        message: 'Successfully retrieved order',
        data: order,
      };
    });
  }

  update(id: string, values: UpdateOrderDtoType) {
    return errorHandler(async () => {
      const order = await this.ordersRepo.findOne('id', id);

      if (!order?.id) {
        throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.ordersRepo.update(id, values);

      return {
        message: 'Successfully updated order',
        data: null,
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const order = await this.ordersRepo.findOne('id', id);

      if (!order?.id) {
        throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.ordersRepo.delete(id);

      return {
        message: 'Successfully deleted order',
        data: null,
      };
    });
  }
}
