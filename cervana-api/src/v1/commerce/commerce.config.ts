import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

const DEFAULT_PLATFORM_FEE_PERCENT = '10';

@Injectable()
export class CommerceConfig {
  private readonly logger = new Logger(CommerceConfig.name);

  constructor(private readonly config: ConfigService) {}

  get earningHoldDays(): number {
    const parsed = Number(this.config.get<string>('CREATOR_EARNING_HOLD_DAYS'));
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 90 ? parsed : 0;
  }

  get platformFeePercent(): Prisma.Decimal {
    const raw = this.config.get<string>('PLATFORM_FEE_PERCENT');
    if (raw === undefined || raw === '') {
      return new Prisma.Decimal(DEFAULT_PLATFORM_FEE_PERCENT);
    }
    try {
      const parsed = new Prisma.Decimal(raw);
      if (parsed.isNaN() || parsed.lessThan(0) || parsed.greaterThan(100) || parsed.decimalPlaces() > 2) {
        throw new Error('out of range');
      }
      return parsed;
    } catch {
      this.logger.warn(`PLATFORM_FEE_PERCENT is invalid; using ${DEFAULT_PLATFORM_FEE_PERCENT}`);
      return new Prisma.Decimal(DEFAULT_PLATFORM_FEE_PERCENT);
    }
  }
}
