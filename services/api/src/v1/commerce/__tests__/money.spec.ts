import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CommerceConfig } from '../commerce.config';
import { computePlatformFee, money, sumMoney, ZERO } from '../money';

const D = (value: string) => new Prisma.Decimal(value);

describe('money', () => {
  it('rounds half up to two decimals', () => {
    expect(money('10.005').toString()).toBe('10.01');
    expect(money('10.004').toString()).toBe('10');
    expect(money(0.1).plus(money(0.2)).toString()).toBe('0.3');
  });

  it('computes the platform fee as a percentage of the total', () => {
    expect(computePlatformFee(D('100000'), D('10')).toString()).toBe('10000');
    expect(computePlatformFee(D('33333.33'), D('10')).toString()).toBe('3333.33');
    expect(computePlatformFee(D('100'), D('12.5')).toString()).toBe('12.5');
    expect(computePlatformFee(D('99.99'), D('0')).toString()).toBe('0');
  });

  it('never charges a fee larger than the total', () => {
    expect(computePlatformFee(D('50'), D('100')).toString()).toBe('50');
    expect(computePlatformFee(D('50'), D('150')).toString()).toBe('50');
  });

  it('keeps fee plus creator amount equal to the gross amount for awkward prices', () => {
    for (const price of ['0.01', '0.99', '1.01', '19999.99', '33333.33', '123456.78']) {
      const gross = money(price);
      const fee = computePlatformFee(gross, D('10'));
      expect(gross.minus(fee).plus(fee).equals(gross)).toBe(true);
      expect(gross.minus(fee).greaterThanOrEqualTo(0)).toBe(true);
    }
  });

  it('sums decimals exactly', () => {
    expect(sumMoney([D('0.1'), D('0.2'), D('0.3')]).toString()).toBe('0.6');
    expect(sumMoney([]).equals(ZERO)).toBe(true);
  });
});

describe('CommerceConfig', () => {
  const percent = (value?: string) =>
    new CommerceConfig(new ConfigService(value === undefined ? {} : { PLATFORM_FEE_PERCENT: value })).platformFeePercent.toString();

  it('defaults to ten percent', () => {
    expect(percent()).toBe('10');
    expect(percent('')).toBe('10');
  });

  it('reads a valid percentage', () => {
    expect(percent('15')).toBe('15');
    expect(percent('7.5')).toBe('7.5');
    expect(percent('0')).toBe('0');
    expect(percent('100')).toBe('100');
  });

  it('falls back to the default for invalid values', () => {
    for (const bad of ['abc', '-1', '101', '5.555', 'NaN']) {
      expect(percent(bad)).toBe('10');
    }
  });
});
