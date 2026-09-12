import type { Query, Tokens } from "~/interfaces/api"
import type {
  NotificationDetailResponse,
  NotificationsListResponse,
} from "~/interfaces/notification"
import { request, toQueryString } from "~/lib/api"

export const notificationService = {
  async findAll<IncludeUser extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)

    const urlUser = queryString
      ? `/notifications?${queryString}`
      : `/notifications`

    const urlGlobal = `/notifications?isGlobal=true`

    const [userRes, globalRes] = await Promise.all([
      request<NotificationsListResponse<IncludeUser>>(
        urlUser,
        "GET",
        undefined,
        {},
        true,
        tokens
      ),
      request<NotificationsListResponse<IncludeUser>>(
        urlGlobal,
        "GET",
        undefined,
        {},
        true,
        tokens
      )
    ])

    const userData = userRes?.data ?? {
      data: [],
      pagination: { total: 0, page: 1, pageSize: 10 }
    }

    const globalData = globalRes?.data ?? {
      data: [],
      pagination: { total: 0, page: 1, pageSize: 10 }
    }

    const mergedData = [
      ...(userData.data ?? []),
      ...(globalData.data ?? [])
    ]

    const mergedPagination = {
      total: (userData.pagination?.total ?? 0) + (globalData.pagination?.total ?? 0),
      page: userData.pagination?.page ?? 1,
      pageSize: userData.pagination?.total ?? 10
    }

    return {
      data: mergedData,
      pagination: mergedPagination
    }
  },

  async findOne<IncludeUser extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const qs = toQueryString(q)
    const url = qs ? `/notifications/${id}?${qs}` : `/notifications/${id}`

    return request<NotificationDetailResponse<IncludeUser>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async update(id: string, body: object = {}, tokens?: Tokens) {
    const url = `/notifications/${id}`

    return request(
      url,
      "PATCH",
      body,
      {},
      true,
      tokens
    )
  },

  async delete(id: string, tokens?: Tokens) {
    const url = `/notifications/${id}`

    return request(
      url,
      "DELETE",
      undefined,
      {},
      true,
      tokens
    )
  }
}
