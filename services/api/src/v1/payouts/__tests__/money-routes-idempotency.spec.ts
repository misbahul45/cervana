import 'reflect-metadata';
import { PayoutsController, AdminPayoutsController } from '../payouts.controller';
import { OrderRefundsController, AdminRefundsController } from '../../refunds/refunds.controller';
import { AdminPaymentsController } from '../../payments/admin-payments.controller';
import { REQUIRE_IDEMPOTENCY_KEY } from '@/common/idempotency/require-idempotency-key.decorator';

describe('Money routes are decorated with RequireIdempotencyKey (I-01)', () => {
  it.each([
    ['PayoutsController.request', PayoutsController.prototype.request],
    ['PayoutsController.cancel', PayoutsController.prototype.cancel],
    ['AdminPayoutsController.startReview', AdminPayoutsController.prototype.startReview],
    ['AdminPayoutsController.approve', AdminPayoutsController.prototype.approve],
    ['AdminPayoutsController.markPaid', AdminPayoutsController.prototype.markPaid],
    ['AdminPayoutsController.reject', AdminPayoutsController.prototype.reject],
    ['OrderRefundsController.request', OrderRefundsController.prototype.request],
    ['AdminRefundsController.create', AdminRefundsController.prototype.create],
    ['AdminRefundsController.approve', AdminRefundsController.prototype.approve],
    ['AdminRefundsController.reject', AdminRefundsController.prototype.reject],
    ['AdminRefundsController.process', AdminRefundsController.prototype.process],
    ['AdminPaymentsController.startReview', AdminPaymentsController.prototype.startReview],
    ['AdminPaymentsController.approve', AdminPaymentsController.prototype.approve],
    ['AdminPaymentsController.reject', AdminPaymentsController.prototype.reject],
    ['AdminPaymentsController.reconcile', AdminPaymentsController.prototype.reconcile],
    ['AdminPaymentsController.expireDue', AdminPaymentsController.prototype.expireDue],
  ])('%s has the metadata', (_name, handler) => {
    expect(Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, handler)).toBe(true);
  });
});