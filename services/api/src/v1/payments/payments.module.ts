import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentConfig } from './payment.config';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentService } from './payment.service';
import { PAYMENT_PROVIDER_ADAPTERS } from './payment.types';
import { PaymentsController } from './payments.controller';
import { ManualPaymentProvider } from './providers/manual/manual-payment.provider';
import { ManualPaymentService } from './providers/manual/manual-payment.service';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [PaymentsController, AdminPaymentsController, PaymentWebhookController],
  providers: [
    PaymentConfig,
    ManualPaymentProvider,
    {
      provide: PAYMENT_PROVIDER_ADAPTERS,
      useFactory: (manual: ManualPaymentProvider) => [manual],
      inject: [ManualPaymentProvider],
    },
    PaymentProviderRegistry,
    PaymentService,
    ManualPaymentService,
  ],
  exports: [PaymentService, PaymentProviderRegistry, PaymentConfig],
})
export class PaymentsModule {}
