import type { PaginationMeta } from "../api";
import type { User } from "../auth";
import type { BaseSubTopic } from "../curriculum/subTopics";

export enum LearningStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export interface SubTopicProgress {
  id: string;

  userId: string;
  subTopicId: string;

  progress: number;
  completed: boolean;
  status: LearningStatus;

  startedAt: string | Date;
  completedAt?: string | Date | null;

  // relations
  user?: User;
  subTopic?: BaseSubTopic;
}

export interface SubTopicProgressDetailResponse<
  IncludeRelations extends boolean = false
> extends SubTopicProgress {
  user?: IncludeRelations extends true ? User : undefined;
  subTopic?: IncludeRelations extends true ? BaseSubTopic : undefined;
}

export interface SubTopicProgressListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? SubTopicProgressDetailResponse<true>
    : SubTopicProgress)[];
  pagination: PaginationMeta;
}
