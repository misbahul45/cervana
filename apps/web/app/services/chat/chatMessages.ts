import type { Query, Tokens } from "~/interfaces/api"
import type { ChatMessageDetailResponse } from "~/interfaces/chats/chat"
import type { ChatMessagesListResponse } from "~/interfaces/chats/chatMessage"
import { requestAi } from "~/lib/ai"
import { request, toQueryString } from "~/lib/api"

export const chatMessageService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/chat/chats/${q.chatId}/messages?${queryString}`
      : `/chat/chats/${q.chatId}/messages`

    return request<ChatMessagesListResponse<IncludeRelations>>(
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
      ? `/chat/chat-messages/${id}?${queryString}`
      : `/chat/chat-messages/${id}`

    return request<ChatMessageDetailResponse<IncludeRelations>>(
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
      chatId: string
      text?: string | null
      status?: string
      role: string
      userStepId:string
      userId:string
    },
    tokens?: Tokens
  ) {

    const res= request(
      "/chat/chat-messages",
      "POST",
      {
        chatId: data.chatId,
        text: data.text || null,
        status: data.status || "COMPLETED",
        role: data.role,
      },
      {},
      true,
      tokens
    )

    const res2=await request(
      "/chat/chat-messages",
      "POST",
      {
        chatId: data.chatId,
        text: "AI is processing the response...",
        status: "PENDING" ,
        role: "ASSISTANT",
      },
      {},
      true,
      tokens
    )

    const AI_URL= useRuntimeConfig().public.AI_URL
    requestAi(
      `${AI_URL}/learning/chat`,
      "POST",
      {
        chatId: data.chatId,
        query: data.text || "",
        userStepId: data.userStepId,
        userId: data.userId,
        messageId: (res2.data as any).id,
      },
      {},
      false,
      tokens
    )

    return res
  },

  async update(
    id: string,
    data: Partial<{
      text: string | null
      role: string
      status: string
    }>,
    tokens?: Tokens
  ) {
    return request(
      `/chat/chat-messages/${id}`,
      "PATCH",
      data,
      {},
      true,
      tokens
    )
  },

  listenChatMessages(tokens?: Tokens) {
    const config = useRuntimeConfig()
    const API_URL = config.public.API_URL
    return new EventSource(`${API_URL}/chat-message-sse`, {
      withCredentials: true
    })
  },

  async delete(id: string, tokens?: Tokens) {
    return request(
      `/chat/chat-messages/${id}`,
      "DELETE",
      undefined,
      {},
      true,
      tokens
    )
  }
}
