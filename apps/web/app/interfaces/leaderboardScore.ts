import type { User } from './auth'
import type { BaseCategory } from './categories'
import type { BaseSubTopic } from './curriculum/subTopics'
import type { BaseTopic } from './curriculum/topics'

export interface LeaderboardScore {
  id: string
  userId: string
  user?: Partial<User> | null
  categoryId?: string | null
  category?: Partial<BaseCategory> | null
  topicId?: string | null
  topic?: Partial<BaseTopic> | null
  subTopicId?: string | null
  subTopic?: Partial<BaseSubTopic> | null
  scope?: 'GLOBAL' | 'CATEGORY' | 'TOPIC' | 'SUBTOPIC'
  score?: number
  updatedAt: Date | string
}
