import type { User } from "./auth.type";
import type { Category } from "./category.type";
import type { Topic } from "./topic.type";
import type { SubTopic } from "./subTopic.type";

export enum LeaderboardScope {
  GLOBAL = "GLOBAL",
  CATEGORY = "CATEGORY",
  TOPIC = "TOPIC",
  SUBTOPIC = "SUBTOPIC"
}

export interface LeaderboardScore {
  id: string;
  userId: string;
  user?: User;
  categoryId?: string | null;
  category?: Category | null;
  topicId?: string | null;
  topic?: Topic | null;
  subTopicId?: string | null;
  subTopic?: SubTopic | null;
  scope: LeaderboardScope;
  score: number;
  updatedAt: Date;
}
