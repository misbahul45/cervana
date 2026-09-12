import type { PaginationMeta } from "../api";
import type { User } from "../auth";
import type { BaseLesson } from "../curriculum/lessons";

export interface LessonProgress {
  id: string

  userId: string
  lessonId: string

  isDone: boolean
  percentage: number
  introduction?:string;
  createdAt: string | Date
  updatedAt: string | Date

  // relations (optional)
  user?: User
  lesson?: BaseLesson
}


export interface LessonProgressDetailResponse<
  IncludeRelations extends boolean = false
> extends LessonProgress {
  user?: IncludeRelations extends true ? User : undefined;
  lesson?: IncludeRelations extends true ? BaseLesson : undefined;
}

export interface LessonProgressListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? LessonProgressDetailResponse<true>
    : LessonProgress)[];
  pagination: PaginationMeta;
}
