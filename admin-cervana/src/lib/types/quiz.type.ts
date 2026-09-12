import type { User } from "./auth.type";

export enum QuizType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  TRUE_FALSE = "TRUE_FALSE",
  SHORT_ANSWER = "SHORT_ANSWER",
  MATCHING = "MATCHING",
  FILL_IN_THE_BLANK = "FILL_IN_THE_BLANK"
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuizType;
  options?: QuizOption[];
  answerExplanation?: string;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  timeLimit?: number;
  totalPoints?: number;
  questions: QuizQuestion[];
  createdBy?: string;
  teacher?: User;
  createdAt: Date;
  updatedAt: Date;
}
