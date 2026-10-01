import { Inject, Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PaymentConfig } from './payment.config';
import { PAYMENT_PROVIDER_ADAPTERS, PaymentProviderAdapter } from './payment.types';

@Injectable()
export class PaymentProviderRegistry {
  private readonly adapters: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    @Inject(PAYMENT_PROVIDER_ADAPTERS) adapters: PaymentProviderAdapter[],
    private readonly config: PaymentConfig,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  active(): PaymentProviderAdapter {
    return this.get(this.config.activeProvider);
  }

  get(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new AppError(
        `Payment provider ${provider} is not available`,
        503,
        AppErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
      );
    }
    return adapter;
  }

  registered(): PaymentProvider[] {
    return [...this.adapters.keys()];
  }
}
