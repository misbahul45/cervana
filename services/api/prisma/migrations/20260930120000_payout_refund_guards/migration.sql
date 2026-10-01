CREATE UNIQUE INDEX "PayoutRequest_one_open_per_wallet" ON "PayoutRequest"("walletId") WHERE "status" IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED');

CREATE UNIQUE INDEX "Refund_one_open_per_payment" ON "Refund"("paymentIntentId") WHERE "status" IN ('REQUESTED', 'APPROVED');
