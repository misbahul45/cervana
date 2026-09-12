import type { PaginationMeta } from "../api"
import type { BaseChat, ChatMessageDetailResponse } from "./chat"

export interface BaseContent {
  id: string
  chatMessageId?: string | null
  data: string
  citations?: any | null
  metadata?: any | null
  chatId: string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ContentDetailResponse<IncludeRelations extends boolean = false>
  extends BaseContent {
  message?: IncludeRelations extends true ? ChatMessageDetailResponse<true> | null : undefined
  chat?: IncludeRelations extends true ? BaseChat : undefined
  embeddings?: IncludeRelations extends true ? ContentEmbeddingResponse[] : undefined
}

export interface ContentsListResponse<IncludeRelations extends boolean = false> {
  data: (IncludeRelations extends true
    ? ContentDetailResponse<true>
    : ContentDetailResponse<false>)[]
  pagination: PaginationMeta
}

export interface ContentEmbeddingResponse {
  id: string
  contentId: string
  chunkText: string
  embedding: number[]
  metadata?: any | null
  createdAt: Date | string
  updatedAt: Date | string
}
