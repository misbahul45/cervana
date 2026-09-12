import type { Chat } from './chat'

export interface ContentEmbedding {
  id: string
  contentId: string
  chunkText: string
  embedding: any
  metadata?: any | null
  content?: Content | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface Content {
  id: string
  message?: any | null
  type?: 'MARKDOWN' | 'TABLE' | 'MIXED'
  data?: any | null
  citations?: any | null
  metadata?: any | null
  chatId: string
  chat?: Chat | null
  embeddings?: ContentEmbedding[] | null
  createdAt: Date | string
  updatedAt: Date | string
}
