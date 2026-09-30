import type { PaginationMeta } from "./api"
import type { User } from "./auth"
import type { BaseTopic } from "./curriculum/topics"

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FULFILLED = "FULFILLED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  REFUND_PENDING = "REFUND_PENDING",
  REFUNDED = "REFUNDED",
}

export interface OrderPayment {
  id: string
  provider: string
  status: string
  amount: string
  currency: string
  expiresAt: Date | string
  paidAt?: Date | string | null
  presentation?: { type: string; data: Record<string, unknown> } | null
}

export interface BaseOrder {
  id: string
  userId: string
  topicId?: string | null
  subtotal: string
  platformFee: string
  total: string
  amount?: number | null
  payment?: OrderPayment | null
  currency: string
  status: OrderStatus
  gateway?: string | null
  snapToken?: string | null
  paidAt?: Date | string | null
  expiredAt?: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  user?: Partial<User> | null
  topic?: Partial<BaseTopic> | null
}

export interface OrderDetailResponse<
  IncludeRelations extends boolean = false
> extends BaseOrder {
  user?: IncludeRelations extends true ? Partial<User> : undefined
  topic?: IncludeRelations extends true ? Partial<BaseTopic> : undefined
}

export interface OrdersListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? OrderDetailResponse<true>
    : BaseOrder)[]
  pagination: PaginationMeta
}
