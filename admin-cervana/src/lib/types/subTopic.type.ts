import type { Topic } from "./topic.type";
import type { Lesson } from "./lesson.type";
import type { Resource } from "./resource.type";
import type { LeaderboardScore } from "./leaderboard.type.";

export interface SubTopic {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
  topicId: string;
  topic?: Topic;
  lessons?: Lesson[];
  resources?: Resource[];
  leaderbordScores?: LeaderboardScore[];
  createdAt: Date;
  updatedAt: Date;
}
