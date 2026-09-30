import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Public } from '../auth/auth.decorator';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  @Public()
  @Post(':provider')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  handle(): never {
    throw new AppError(
      'Payment provider webhooks are not enabled',
      HttpStatus.NOT_IMPLEMENTED,
      AppErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
    );
  }
}
