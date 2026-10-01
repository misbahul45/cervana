import type { PaginationMeta } from "../api";
import type { User } from "../auth";
import type { BaseChat } from "../chats/chat";
import type { BaseStep } from "../curriculum/step";

export interface UserStep {
  id: string;

  userId: string;
  isUnlocked:boolean;
  stepTemplateId?: string | null;

  title: string;
  description?: string | null;
  isDone: boolean;
  order:number;

  createdAt: string | Date;
  updatedAt: string | Date;

  // relations
  user?: User;
  stepTemplate?: BaseStep;
}

export interface UserStepDetailResponse<
  IncludeRelations extends boolean = false
> extends UserStep {
  user?: IncludeRelations extends true ? User : undefined;
  stepTemplate?: IncludeRelations extends true ? BaseStep : undefined;
  chat?: IncludeRelations extends true ? BaseChat : undefined;
}


export interface UserStepListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? UserStepDetailResponse<true>
    : UserStep)[];
  pagination: PaginationMeta;
}


export interface QuizQuestionBase {
  question: string;
  difficulty: "easy" | "medium" | "hard" | "hots";
  answer: string;
  type: "multiple_choice" | "input" | "scenario";
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: "multiple_choice" | "scenario"; 
  options: string[];
}

export interface InputQuestion extends QuizQuestionBase {
  type: "input";
  options?: undefined; 
}

export type QuizQuestion = MultipleChoiceQuestion | InputQuestion;

export interface GenerateQuestionResponse {
  success: boolean;
  data: QuizQuestion[];
}
