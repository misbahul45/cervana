import type { PaginationMeta } from "../api"
import type { BaseChat, ContentDetailResponse } from "./chat"

export interface BaseChatMessage {
  id: string
  chatId: string
  text?: string | null
  role: string
  status: string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ChatMessageDetailResponse<IncludeRelations extends boolean = false>
  extends BaseChatMessage {
  chat?: IncludeRelations extends true ? BaseChat : undefined
  content?: IncludeRelations extends true ? ContentDetailResponse<true> | null : undefined
}

export interface ChatMessagesListResponse<IncludeRelations extends boolean = false> {
  data: (IncludeRelations extends true
    ? ChatMessageDetailResponse<true>
    : ChatMessageDetailResponse<false>)[]
  pagination: PaginationMeta
}
