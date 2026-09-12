import type { Topic } from "./topic.type";
import type { LeaderboardScore } from "./leaderboard.type.";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  parent?: Category | null;
  children?: Category[];
  topics?: Topic[];
  leaderbordScores?: LeaderboardScore[];
  createdAt: Date;
  updatedAt: Date;
}
