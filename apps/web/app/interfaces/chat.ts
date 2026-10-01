import type { Step } from "./curriculum/step"

export interface ChatMessage {
  id: string
  chatId: string
  chat?: Chat | null
  text?: string | null
  role?: 'USER' | 'ASSISTANT'
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  contentId?: string | null
  content?: Content | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface Content {
  id: string
  message?: ChatMessage | null
  type?: 'MARKDOWN' | 'TABLE' | 'MIXED'
  data?: any | null
  citations?: any | null
  metadata?: any | null
  chatId: string
  chat?: Chat | null
  embeddings?: any[] | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface Chat {
  id: string
  stepId: string
  step?: Step | null
  messages?: ChatMessage[] | null
  contents?: Content[] | null
  title?: string
  updatedAt: Date | string
}
