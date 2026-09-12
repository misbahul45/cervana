import type { PaginationMeta } from "./api"
import type { User } from "./auth"
import type { BaseTopic } from "./curriculum/topics"

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export interface BaseOrder {
  id: string
  userId: string
  topicId: string
  amount: number
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
