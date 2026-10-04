import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { REQUIRE_IDEMPOTENCY_KEY } from '@/common/idempotency/require-idempotency-key.decorator';

describe('OrdersController has RequireIdempotencyKey on POST', () => {
  it('POST handler has the metadata set', () => {
    const meta = Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, OrdersController.prototype.create);
    expect(meta).toBe(true);
  });

  it('POST /:id/cancel handler has the metadata set', () => {
    const meta = Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, OrdersController.prototype.cancel);
    expect(meta).toBe(true);
  });

  it('GET handlers do not have the metadata set', () => {
    const listMeta = Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, OrdersController.prototype.findAll);
    const oneMeta = Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, OrdersController.prototype.findOne);
    expect(listMeta).toBeUndefined();
    expect(oneMeta).toBeUndefined();
  });
});