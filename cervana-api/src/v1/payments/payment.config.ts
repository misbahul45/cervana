import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';

const DEFAULT_INTENT_TTL_MINUTES = 1440;

@Injectable()
export class PaymentConfig {
  constructor(private readonly config: ConfigService) {}

  get activeProvider(): PaymentProvider {
    const raw = (this.config.get<string>('PAYMENT_PROVIDER') ?? 'manual').trim().toUpperCase();
    return (Object.values(PaymentProvider) as string[]).includes(raw)
      ? (raw as PaymentProvider)
      : PaymentProvider.OTHER;
  }

  get intentTtlMinutes(): number {
    const parsed = Number(this.config.get<string>('PAYMENT_INTENT_TTL_MINUTES'));
    return Number.isInteger(parsed) && parsed >= 5 && parsed <= 10080 ? parsed : DEFAULT_INTENT_TTL_MINUTES;
  }

  get maxSubmissionsPerIntent(): number {
    const parsed = Number(this.config.get<string>('MANUAL_PAYMENT_MAX_SUBMISSIONS'));
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : 5;
  }

  get manualAccountsRaw(): string | undefined {
    return this.config.get<string>('MANUAL_PAYMENT_ACCOUNTS');
  }
}
