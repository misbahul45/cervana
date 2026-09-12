import type { SubTopic } from "./subTopic.type";
import type { User } from "@lucide/svelte";
import type { Resource } from "./resource.type";
import type { Category } from "./category.type";
import type { LeaderboardScore } from "./leaderboard.type.";

export interface Topic {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image: {
    url:string,
    fileId?:string | null
  };
  isVerified: boolean;
  isFree: boolean;
  price: number;

  subTopics?: SubTopic[];
  resources?: Resource[];
  categories?: Category[];
  leaderboardScores?: LeaderboardScore[];
  teacher?: User;

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
