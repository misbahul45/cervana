
import type { Query, Tokens } from "~/interfaces/api"
import type { BaseOrder, OrderDetailResponse, OrdersListResponse } from "~/interfaces/order"
import { request, toQueryString } from "~/lib/api"
import { createIdempotencyKey } from "~/composables/useIdempotencyKey"

export const ordersService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?:Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/orders?${queryString}` : "/orders"
    return request<OrdersListResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?:Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/orders/${id}?${queryString}` : `/orders/${id}`
    return request<OrderDetailResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async create(values: Partial<BaseOrder>, tokens?: Tokens, idempotencyKey: string = createIdempotencyKey().current()) {
    return request<BaseOrder>(
      "/orders",
      "POST",
      values,
      { "Idempotency-Key": idempotencyKey },
      true,
      tokens
    )
  },

  async cancel(id: string, tokens?: Tokens, idempotencyKey: string = createIdempotencyKey().current()) {
    return request<BaseOrder>(
      `/orders/${id}/cancel`,
      "POST",
      undefined,
      { "Idempotency-Key": idempotencyKey },
      true,
      tokens
    )
  },
}
