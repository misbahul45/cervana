import type { Query, Tokens } from "~/interfaces/api"
import type { ChatDetailResponse } from "~/interfaces/chats/chat"
import { request, toQueryString } from "~/lib/api"

export const chatService = {
  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/chat/chats/${id}?${queryString}`
      : `/chat/chats/${id}`

    return request<ChatDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async create(
    data: {
      userStepId: string
      title: string
    },
    tokens?: Tokens
  ) {
    return request(
      "/chat/chats",
      "POST",
      data,
      {},
      true,
      tokens
    )
  },

  async update(
    id: string,
    data: Partial<{
      title: string
    }>,
    tokens?: Tokens
  ) {
    return request(
      `/chat/chats/${id}`,
      "PATCH",
      data,
      {},
      true,
      tokens
    )
  },

  async delete(id: string, tokens?: Tokens) {
    return request(
      `/chat/chats/${id}`,
      "DELETE",
      undefined,
      {},
      true,
      tokens
    )
  }
}
