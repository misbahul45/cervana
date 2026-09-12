import type { Query, Tokens } from "~/interfaces/api"
import type { ContentDetailResponse } from "~/interfaces/chats/chat"
import type { ContentsListResponse } from "~/interfaces/chats/content"
import { request, toQueryString } from "~/lib/api"

export const contentService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/chat/contents?${queryString}`
      : "/chat/contents"

    return request<ContentsListResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/chat/contents/${id}?${queryString}`
      : `/chat/contents/${id}`

    return request<ContentDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  listenChatContent(tokens?: Tokens) {
    const config = useRuntimeConfig()
    const API_URL = config.public.API_URL
    return new EventSource(`${API_URL}/content-sse`, {
      withCredentials: true
    })
  },

  async create(
    data: {
      chatId: string
      data: string
      citations?: any | null
      metadata?: any | null
      chatMessageId?: string | null
    },
    tokens?: Tokens
  ) {
    return request(
      "/chat/contents",
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
      data: string
      citations: any | null
      metadata: any | null
      chatMessageId: string | null
    }>,
    tokens?: Tokens
  ) {
    return request(
      `/chat/contents/${id}`,
      "PATCH",
      data,
      {},
      true,
      tokens
    )
  },

  async delete(id: string, tokens?: Tokens) {
    return request(
      `/chat/contents/${id}`,
      "DELETE",
      undefined,
      {},
      true,
      tokens
    )
  }
}
