export const CommerceEvents = {
  OrderFulfilled: 'OrderFulfilled',
  EntitlementGranted: 'EntitlementGranted',
  CreatorEarningCreated: 'CreatorEarningCreated',
  CreatorEarningReleased: 'CreatorEarningReleased',
} as const;

export const ORDER_AGGREGATE = 'Order';
export const ENTITLEMENT_AGGREGATE = 'Entitlement';
export const EARNING_AGGREGATE = 'CreatorEarning';

export interface OrderFulfilledPayload {
  orderId: string;
  paymentIntentId: string;
  userId: string;
  total: string;
  currency: string;
  itemCount: number;
}

export interface EntitlementGrantedPayload {
  orderId: string;
  userId: string;
  resourceType: 'ARTICLE' | 'CLASS' | 'TOPIC';
  resourceId: string;
}

export interface CreatorEarningCreatedPayload {
  earningId: string;
  orderId: string;
  tenantId: string;
  creatorId: string;
  grossAmount: string;
  platformFee: string;
  creatorAmount: string;
  currency: string;
}
