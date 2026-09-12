import type { PaginationMeta } from "../api";
import type { User } from "../auth";
import type { BaseStep } from "../curriculum/step";
import type { Quiz } from "../quiz";
import type { LearningStatus } from "./subTopicProgress";

export interface StepProgress {
  id: string;
  userId: string;
  stepId: string;
  quizId?: string | null;
  progress: number;
  isDone: boolean;
  status: LearningStatus;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  user?: User;
  step?: BaseStep;
  quiz?: Quiz | null;
}

export interface StepProgressDetailResponse<
  IncludeRelations extends boolean = false
> extends StepProgress {
  user?: IncludeRelations extends true ? User : undefined;
  step?: IncludeRelations extends true ? BaseStep : undefined;
  quiz?: IncludeRelations extends true ? Quiz : undefined;
}

export interface StepProgressListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? StepProgressDetailResponse<true>
    : StepProgress)[];
  pagination: PaginationMeta;
}
