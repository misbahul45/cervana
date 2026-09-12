import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { OrdersRepo } from './orders.repo';
import { AppError } from '@/common/lib/error';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly ordersRepo: OrdersRepo) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event;

    try {
      event ={
        type:'payment_intent.succeeded'
      }
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        const { userId, topicId } = paymentIntent.metadata;

        await this.ordersRepo.updateByUserTopic(userId, topicId, {
          status: 'PAID',
          paidAt: new Date(),
        });

        console.log(`✅ Payment succeeded for user ${userId}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        const { userId, topicId } = paymentIntent.metadata;

        await this.ordersRepo.updateByUserTopic(userId, topicId, {
          status: 'FAILED',
        });

        console.log(`❌ Payment failed for user ${userId}`);
        break;
      }

      default:
        console.log(`ℹ️  Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }
}
