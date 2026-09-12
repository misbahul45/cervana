import type { PaginationMeta } from "../api";
import type { User } from "../auth";
import type { BaseTopic } from "../curriculum/topics";
import type { LearningStyleProfile } from "./LearningStyle";


export enum TopicAccessType {
  FREE = "FREE",
  PURCHASED = "PURCHASED",
}

export enum UserTopicStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}


export interface UserTopic {
  id: string;

  userId: string;
  topicId: string;

  accessType: TopicAccessType;
  status: UserTopicStatus;

  progressPercent: number;

  purchasedAt?: string | Date | null;
  expiredAt?: string | Date | null;

  // relations
  user?: User;
  topic?: BaseTopic;
  learningStyleProfile?: LearningStyleProfile | null;
}


export interface UserTopicDetailResponse<
  IncludeRelations extends boolean = false
> extends UserTopic {
  user?: IncludeRelations extends true ? User : undefined;
  topic?: IncludeRelations extends true ? BaseTopic : undefined;
  learningStyleProfile?: IncludeRelations extends true
    ? LearningStyleProfile | null
    : undefined;
}

export interface UserTopicListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? UserTopicDetailResponse<true>
    : UserTopic)[];
  pagination: PaginationMeta;
}
