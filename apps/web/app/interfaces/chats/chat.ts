import type { UserStep } from "../learning/userSteps"

export interface BaseChat {
  id: string
  userStepId: string
  title: string
  updatedAt: Date | string
}

export interface ChatDetailResponse<IncludeRelations extends boolean = false>
  extends BaseChat {
  userStep?: IncludeRelations extends true ? UserStep : undefined
  messages?: IncludeRelations extends true ? ChatMessageDetailResponse<true>[] : undefined
  contents?: IncludeRelations extends true ? ContentDetailResponse<true>[] : undefined
}

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

export interface ContentEmbeddingResponse {
  id: string
  contentId: string
  chunkText: string
  embedding: number[]
  metadata?: any | null
  createdAt: Date | string
  updatedAt: Date | string
}
