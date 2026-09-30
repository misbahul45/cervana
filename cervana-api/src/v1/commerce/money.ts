import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;

export const money = (value: Prisma.Decimal.Value): Money =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const ZERO: Money = money(0);

export function computePlatformFee(total: Money, percent: Prisma.Decimal): Money {
  const fee = money(total.mul(percent).div(100));
  return fee.greaterThan(total) ? total : fee;
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((acc, value) => acc.plus(value), ZERO);
}
