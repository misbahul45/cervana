import type { Lesson } from "./curriculum/lessons"
import type { Step } from "./curriculum/step"
import type { BaseSubTopic } from "./curriculum/subTopics"
import type { BaseTopic } from "./curriculum/topics"


export interface Resource {
  id: string
  type: 'VIDEO' | 'TEXT' | 'PDF' | 'LINK' | 'IMAGE' | 'INTERACTIVE'
  title?: string | null
  content?: string | null
  file?: { url: string; fileId: string } | null
  topicId?: string | null
  subTopicId?: string | null
  lessonId?: string | null
  stepId?: string | null
  isEmbedded?: boolean
  embeddingAt?: Date | string
  jobStatus?: 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'PENDING'
  topic?: BaseTopic | null
  subTopic?: BaseSubTopic | null
  lesson?: Lesson | null
  step?: Step | null
  createdAt: Date | string
  updatedAt: Date | string
}
